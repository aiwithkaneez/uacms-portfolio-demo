import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.encryption import ENCRYPTED_CATEGORIES, decrypt_if_sensitive, encrypt_if_sensitive
from app.core.rate_limit import rate_limit_public_endpoint
from app.db.database import get_db
from app.models.complaint import Complaint, ComplaintAttachment, ComplaintTimelineEvent
from app.schemas.complaint import (
    PublicComplaintCreateRequest,
    PublicComplaintCreateResponse,
    PublicComplaintStatusRequest,
    PublicComplaintStatusResponse,
    PublicTimelineEventResponse,
)
from app.services import assignment_service
from app.services.email_service import mask_email, send_complaint_id_email

router = APIRouter(prefix="/complaints/public", tags=["Public Complaints"])
DbSession = Annotated[Session, Depends(get_db)]

# Internal notes and suggestion-decision events are desk-owner working
# material, not something a public complainant with no account should see.
PUBLIC_VISIBLE_EVENT_TYPES = frozenset({"status_change", "escalation"})

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "complaints"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _encrypt_contact_if_sensitive(category: str, value: str | None) -> str | None:
    if value is None or category not in ENCRYPTED_CATEGORIES:
        return value
    return encrypt_if_sensitive(category, value)


def _decrypt_contact_if_sensitive(category: str, value: str | None) -> str | None:
    if value is None or category not in ENCRYPTED_CATEGORIES:
        return value
    return decrypt_if_sensitive(category, value)


@router.post("", response_model=PublicComplaintCreateResponse, status_code=status.HTTP_201_CREATED)
def submit_public_complaint(
    payload: PublicComplaintCreateRequest,
    db: DbSession,
    _rate_limit: Annotated[None, Depends(rate_limit_public_endpoint)],
) -> PublicComplaintCreateResponse:
    """No-login submission — open to anyone (BRD v2.0 scoped this to
    employees/outsourced staff only; extended here to genuinely public
    complainants per explicit product decision, not a BRD requirement).

    complainant_id always stays NULL (no account exists). Ownership for a
    later status check is proven via contact_phone/contact_email instead —
    see /complaints/public/status.
    """
    desk, desk_owner = assignment_service.assign(db, payload.category)
    category_value = payload.category.value
    case_id = assignment_service.generate_case_id(db)

    complaint = Complaint(
        case_id=case_id,
        complainant_id=None,
        is_anonymous=payload.is_anonymous,
        submission_source="public",
        contact_phone=_encrypt_contact_if_sensitive(category_value, payload.phone),
        contact_email=_encrypt_contact_if_sensitive(category_value, payload.email),
        submitter_employee_id=payload.employee_id,
        description=encrypt_if_sensitive(category_value, payload.description),
        category=category_value,
        assigned_desk=desk,
        assigned_to=desk_owner.id if desk_owner else None,
        status="new",
    )
    db.add(complaint)
    db.flush()

    db.add(
        ComplaintTimelineEvent(
            complaint_id=complaint.id,
            actor_id=None,
            event_type="status_change",
            from_status=None,
            to_status="new",
        )
    )

    db.commit()
    db.refresh(complaint)

    email_sent = False
    notified_email = None
    if payload.email:
        email_sent = send_complaint_id_email(str(payload.email), complaint.case_id, is_public=True)
        if email_sent:
            notified_email = mask_email(str(payload.email))

    return PublicComplaintCreateResponse(
        case_id=complaint.case_id,
        email_sent=email_sent,
        notified_email=notified_email,
    )


@router.post("/evidence/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def upload_public_evidence(
    case_id: str,
    db: DbSession,
    _rate_limit: Annotated[None, Depends(rate_limit_public_endpoint)],
    evidence: UploadFile,
) -> None:
    """Separate from submission so the JSON create-complaint request stays
    simple — mirrors evidence being optional either way. Anyone who knows
    the case_id could technically call this; the only consequence is
    attaching a file to that case, which is no more sensitive than the
    complaint itself already being identified by a guessable-looking ID,
    and it's rate-limited the same as submission.
    """
    complaint = db.scalar(select(Complaint).where(Complaint.case_id == case_id, Complaint.submission_source == "public"))
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    if not evidence.filename:
        return

    ext = Path(evidence.filename).suffix
    stored_name = f"{complaint.case_id}-{uuid.uuid4().hex[:8]}{ext}"
    dest_path = UPLOAD_DIR / stored_name
    contents = await evidence.read()
    dest_path.write_bytes(contents)

    db.add(
        ComplaintAttachment(
            complaint_id=complaint.id,
            file_name=evidence.filename,
            file_path=str(dest_path),
            content_type=evidence.content_type,
        )
    )
    db.commit()


@router.post("/status", response_model=PublicComplaintStatusResponse)
def check_public_complaint_status(
    payload: PublicComplaintStatusRequest,
    db: DbSession,
    _rate_limit: Annotated[None, Depends(rate_limit_public_endpoint)],
) -> PublicComplaintStatusResponse:
    """Proof of ownership is case_id + a matching contact field — anyone
    could see a case_id (it's shown right after submission and isn't
    treated as a secret), so matching contact info is what actually gates
    access here. Returns a generic 404 on any mismatch rather than 403, so
    a wrong guess can't be used to confirm a case_id is real (enumeration).
    """
    complaint = db.scalar(
        select(Complaint)
        .where(Complaint.case_id == payload.case_id, Complaint.submission_source == "public")
    )
    not_found = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching complaint found")
    if complaint is None:
        raise not_found

    stored_phone = _decrypt_contact_if_sensitive(complaint.category, complaint.contact_phone)
    stored_email = _decrypt_contact_if_sensitive(complaint.category, complaint.contact_email)

    phone_matches = payload.phone is not None and payload.phone == stored_phone
    email_matches = payload.email is not None and payload.email.lower() == (stored_email or "").lower()
    if not (phone_matches or email_matches):
        raise not_found

    due_at = assignment_service.calculate_due_date(complaint.created_at, complaint.category)
    timeline = [
        PublicTimelineEventResponse.model_validate(event)
        for event in complaint.timeline_events
        if event.event_type in PUBLIC_VISIBLE_EVENT_TYPES
    ]

    return PublicComplaintStatusResponse(
        case_id=complaint.case_id,
        category=complaint.category,
        status=complaint.status,
        created_at=complaint.created_at,
        due_at=due_at,
        timeline=timeline,
    )
