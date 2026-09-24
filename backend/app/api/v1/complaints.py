import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from app.services.assignment_service import (
    calculate_due_date,
    get_tat_hours,
)
from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.encryption import ENCRYPTED_CATEGORIES, decrypt_if_sensitive, encrypt_if_sensitive
from app.dependencies.auth import get_current_active_user, require_role
from app.models.complaint import Complaint, ComplaintAttachment, ComplaintTimelineEvent
from app.models.user import User
from app.services.email_service import mask_email, send_complaint_id_email
from app.services.export_service import build_xlsx
from app.schemas.complaint import (
    AdminComplaintOverviewItem,
    CategoryCheckRequest,
    CategoryCheckResponse,
    ComplaintCategory,
    ComplaintCreateResponse,
    ComplaintDetailResponse,
    ComplaintListItem,
    ComplaintReassignRequest,
    ComplaintStatusUpdateRequest,
    DashboardStatsResponse,
    DeskQueueItem,
    EscalatedComplaintItem,
    SuggestionDecisionRequest,
    SuggestionItem,
    SuggestionResponse,
    SuggestionStatsResponse,
    TimelineEventResponse,
)
from app.db.database import get_db
from app.services import assignment_service, escalation_service, suggestion_service

router = APIRouter(prefix="/complaints", tags=["Complaints"])
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_active_user)]

ELEVATED_ROLES = frozenset({"Executive", "Knowledge Base Admin", "System Admin"})
RESOLVED_STATUSES = frozenset({"resolved", "closed"})

# Local disk storage for Week 2. Swap for S3/blob storage later without changing the API shape.
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "complaints"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

VALID_TRANSITIONS: dict[str, set[str]] = {
    "new": {"in_progress"},
    "in_progress": {"resolved"},
    "resolved": {"closed", "in_progress"},
    "closed": set(),
}


def _submitted_by_label(complaint: Complaint) -> str:
    if complaint.is_anonymous:
        return "Anonymous"
    if complaint.submission_source == "public":
        return "Public Complainant"
    if complaint.complainant is None:
        return "Anonymous"
    return complaint.complainant.full_name


def _decrypt_contact(complaint: Complaint, value: str | None) -> str | None:
    if value is None:
        return None
    return decrypt_if_sensitive(complaint.category, value)


def _to_detail_response(complaint: Complaint) -> ComplaintDetailResponse:
    # Contact info only surfaces for a disclosed public submission — never
    # for anonymous ones, and never for employee-portal complaints (that
    # flow doesn't collect it; the account is the identity there).
    show_contact = complaint.submission_source == "public" and not complaint.is_anonymous

    return ComplaintDetailResponse(
        id=complaint.id,
        case_id=complaint.case_id,
        category=complaint.category,
        status=complaint.status,
        is_anonymous=complaint.is_anonymous,
        description=decrypt_if_sensitive(complaint.category, complaint.description),
        assigned_desk=complaint.assigned_desk,
        submitted_by=_submitted_by_label(complaint),
        contact_phone=_decrypt_contact(complaint, complaint.contact_phone) if show_contact else None,
        contact_email=_decrypt_contact(complaint, complaint.contact_email) if show_contact else None,
        submitter_employee_id=complaint.submitter_employee_id if show_contact else None,

        created_at=complaint.created_at,
        updated_at=complaint.updated_at,

        # NEW
        tat_hours=get_tat_hours(complaint.category),
        due_at=calculate_due_date(
            complaint.created_at,
            complaint.category,
        ),
        is_escalated=complaint.is_escalated,
        escalated_at=complaint.escalated_at,

        attachments=complaint.attachments,
        timeline=[
            TimelineEventResponse.model_validate(event)
            for event in complaint.timeline_events
        ],
    )


def _compute_dashboard_stats(complaints: list[Complaint]) -> DashboardStatsResponse:
    """Aggregate raw complaint rows into the shapes the Executive Dashboard charts need.

    Note: there's no separate "resolved_at" timestamp in the schema. For
    resolved/closed complaints we treat `updated_at` as the resolution moment;
    for still-open complaints we compare against the current time. If a
    dedicated resolved_at field gets added later, swap it in here.
    """
    total = len(complaints)
    open_count = 0
    resolved_count = 0
    resolution_days_total = 0.0
    resolution_days_count = 0

    category_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}

    within_tat = 0
    overdue = 0
    escalated_count = 0
    now = datetime.now(timezone.utc)

    for c in complaints:
        if c.is_escalated:
            escalated_count += 1
        category_counts[c.category] = category_counts.get(c.category, 0) + 1
        status_counts[c.status] = status_counts.get(c.status, 0) + 1

        is_resolved = c.status in RESOLVED_STATUSES
        if not is_resolved:
            open_count += 1
        if is_resolved:
            resolved_count += 1
            resolution_days_total += (c.updated_at - c.created_at).total_seconds() / 86400
            resolution_days_count += 1

        due_at = calculate_due_date(c.created_at, c.category)
        reference_time = c.updated_at if is_resolved else now
        if reference_time <= due_at:
            within_tat += 1
        else:
            overdue += 1

    avg_resolution_days = (
        round(resolution_days_total / resolution_days_count, 1) if resolution_days_count else None
    )
    within_tat_percent = round((within_tat / total) * 100, 1) if total else 0.0
    overdue_percent = round((overdue / total) * 100, 1) if total else 0.0

    return DashboardStatsResponse(
        total_complaints=total,
        open_count=open_count,
        resolved=resolved_count,
        avg_resolution_days=avg_resolution_days,
        by_category=dict(labels=list(category_counts.keys()), data=list(category_counts.values())),
        by_status=dict(labels=list(status_counts.keys()), data=list(status_counts.values())),
        tat_compliance=dict(within_tat_percent=within_tat_percent, overdue_percent=overdue_percent),
        escalated_count=escalated_count,
    )


@router.post("", response_model=ComplaintCreateResponse, status_code=status.HTTP_201_CREATED)
async def submit_complaint(
    db: DbSession,
    current_user: CurrentUser,
    description: Annotated[str, Form(min_length=10)],
    category: Annotated[ComplaintCategory, Form()],
    is_anonymous: Annotated[bool, Form()] = False,
    evidence: UploadFile | None = None,
) -> ComplaintCreateResponse:
    desk, desk_owner = assignment_service.assign(db, category)
    case_id = assignment_service.generate_case_id(db)

    complaint = Complaint(
        case_id=case_id,
        complainant_id=None if is_anonymous else current_user.id,
        is_anonymous=is_anonymous,
        description=encrypt_if_sensitive(category.value, description),
        category=category.value,
        assigned_desk=desk,
        assigned_to=desk_owner.id if desk_owner else None,
        status="new",
    )
    db.add(complaint)
    db.flush()

    db.add(
        ComplaintTimelineEvent(
            complaint_id=complaint.id,
            actor_id=None if is_anonymous else current_user.id,
            event_type="status_change",
            from_status=None,
            to_status="new",
        )
    )

    if evidence is not None and evidence.filename:
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
    db.refresh(complaint)

    email_sent = send_complaint_id_email(current_user.email, complaint.case_id, is_public=False)
    return ComplaintCreateResponse(
        id=complaint.id,
        case_id=complaint.case_id,
        status=complaint.status,
        email_sent=email_sent,
        notified_email=mask_email(current_user.email) if email_sent else None,
    )


@router.post("/category-check", response_model=CategoryCheckResponse)
def check_category(payload: CategoryCheckRequest, db: DbSession, current_user: CurrentUser) -> CategoryCheckResponse:
    """Soft, non-blocking pre-submission check: does this complaint's wording
    match a different category's policy corpus clearly better than the one
    picked? Called from the Submit Complaint form before the real POST, not
    part of it — never prevents a complaint from being registered. See
    suggestion_service.check_category_mismatch for why this stays a warning,
    not a gate.
    """
    result = suggestion_service.check_category_mismatch(db, payload.category.value, payload.description)
    if result is None:
        return CategoryCheckResponse()
    return CategoryCheckResponse(**result)


@router.get("", response_model=list[ComplaintListItem])
def list_my_complaints(db: DbSession, current_user: CurrentUser) -> list[Complaint]:
    """View Complaint History — complaints submitted by the logged-in user (excludes their own anonymous ones, by design)."""
    complaints = db.scalars(
        select(Complaint).where(Complaint.complainant_id == current_user.id).order_by(Complaint.created_at.desc())
    ).all()
    return list(complaints)


@router.get("/desk", response_model=list[DeskQueueItem])
def list_desk_queue(
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("Desk Owner"))],
) -> list[DeskQueueItem]:
    """Assigned Complaint Retrieval — complaints routed to the logged-in desk owner."""
    escalation_service.escalate_overdue_complaints(db)

    complaints = db.scalars(
        select(Complaint)
        .options(joinedload(Complaint.complainant))
        .where(Complaint.assigned_to == current_user.id)
        .order_by(Complaint.created_at.desc())
    ).all()

    return [
        DeskQueueItem(
            id=c.id,
            case_id=c.case_id,
            category=c.category,
            status=c.status,
            is_anonymous=c.is_anonymous,
            submitted_by=_submitted_by_label(c),
            created_at=c.created_at,
            is_escalated=c.is_escalated,
        )
        for c in complaints
    ]


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: DbSession,
    current_user: CurrentUser,
    category: ComplaintCategory | None = None,
) -> DashboardStatsResponse:
    """Executive Dashboard aggregates — org-wide category/status/TAT breakdowns.

    Restricted the same way get_complaint() restricts privileged access: checked
    manually against ELEVATED_ROLES rather than via require_role(), since this
    needs to allow several roles, not just one.

    `category` narrows every number in the response to that one category —
    "All Categories" (the default, `category` omitted) is the original
    org-wide view.
    """
    role_name = current_user.role.name
    if role_name not in ELEVATED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view dashboard analytics")

    escalation_service.escalate_overdue_complaints(db)

    query = select(Complaint)
    if category is not None:
        query = query.where(Complaint.category == category.value)
    complaints = db.scalars(query).all()
    return _compute_dashboard_stats(list(complaints))


@router.get("/suggestion-stats", response_model=SuggestionStatsResponse)
def get_suggestion_stats(db: DbSession, current_user: CurrentUser) -> SuggestionStatsResponse:
    """Acceptance-rate evaluation metric for the suggestion engine — how many
    desk-owner decisions on AI suggestions were accepted vs. modified vs.
    overridden. Same restriction as /stats: dashboard-analytics roles only.

    Registered here, before /{complaint_id}, not after it further down the
    file — FastAPI matches routes in registration order and only validates
    the {complaint_id}: int type *after* the path already matched, so a
    route placed after /{complaint_id} gets shadowed and returns a 422
    instead of ever running (caught by testing this exact bug).
    """
    role_name = current_user.role.name
    if role_name not in ELEVATED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view dashboard analytics")

    decisions = db.scalars(
        select(ComplaintTimelineEvent.decision_action).where(ComplaintTimelineEvent.event_type == "suggestion_decision")
    ).all()

    total = len(decisions)
    accepted = sum(1 for d in decisions if d == "accept")
    modified = sum(1 for d in decisions if d == "modify")
    overridden = sum(1 for d in decisions if d == "override")

    def pct(count: int) -> float:
        return round((count / total) * 100, 1) if total else 0.0

    return SuggestionStatsResponse(
        total_decisions=total,
        accepted=accepted,
        modified=modified,
        overridden=overridden,
        accepted_percent=pct(accepted),
        modified_percent=pct(modified),
        overridden_percent=pct(overridden),
    )


@router.get("/escalated", response_model=list[EscalatedComplaintItem])
def list_escalated_complaints(
    db: DbSession,
    current_user: CurrentUser,
    category: ComplaintCategory | None = None,
) -> list[EscalatedComplaintItem]:
    """BRD 3.4 Auto-Escalation, dedicated view: every complaint that missed
    its TAT while still "New" — the surface Executives/System Admin actually
    check, instead of relying on a desk owner noticing their own overdue
    badge. Same role restriction as /stats. Registered before
    /{complaint_id} for the same route-ordering reason as /stats and
    /suggestion-stats above.

    Full complaint body + desk activity log included — per HR (M. Waqas)
    policy confirmation that Executives should see the full body and
    desk responses once a complaint is escalated, not just case number
    and dates.
    """
    role_name = current_user.role.name
    if role_name not in ELEVATED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view escalated complaints")

    escalation_service.escalate_overdue_complaints(db)

    query = select(Complaint).options(joinedload(Complaint.timeline_events)).where(Complaint.is_escalated.is_(True))
    if category is not None:
        query = query.where(Complaint.category == category.value)
    complaints = db.scalars(query.order_by(Complaint.escalated_at.desc())).unique().all()

    return [
        EscalatedComplaintItem(
            id=c.id,
            case_id=c.case_id,
            category=c.category,
            status=c.status,
            assigned_desk=c.assigned_desk,
            created_at=c.created_at,
            escalated_at=c.escalated_at,
            description=decrypt_if_sensitive(c.category, c.description),
            timeline=[TimelineEventResponse.model_validate(event) for event in c.timeline_events],
        )
        for c in complaints
    ]


def _response_time_hours(complaint: Complaint) -> float | None:
    first_pickup = next(
        (
            event
            for event in complaint.timeline_events
            if event.event_type == "status_change" and event.to_status == "in_progress"
        ),
        None,
    )
    if first_pickup is None:
        return None
    return round((first_pickup.created_at - complaint.created_at).total_seconds() / 3600, 1)


@router.get("/admin-overview", response_model=list[AdminComplaintOverviewItem])
def list_admin_overview(
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("System Admin"))],
    category: ComplaintCategory | None = None,
) -> list[AdminComplaintOverviewItem]:
    """System Admin's complaint-level oversight — every complaint, which
    desk it's on, how long it took to get a response, and escalation state.
    Not the same as /stats: that's Executive's aggregate charts, this is
    the row-level table System Admin actually asked for. Registered before
    /{complaint_id} for the same route-ordering reason as /stats above.

    Full description text for every category, including Whistleblow/
    Harassment — per HR (M. Waqas) policy confirmation, System Admin has
    full view/edit/escalation rights over all complaints, reversing the
    original BRD table's exclusion. Same boundary change applied to
    GET /complaints/{id}.
    """
    escalation_service.escalate_overdue_complaints(db)

    query = select(Complaint).options(joinedload(Complaint.timeline_events))
    if category is not None:
        query = query.where(Complaint.category == category.value)
    complaints = db.scalars(query.order_by(Complaint.created_at.desc())).unique().all()

    return [
        AdminComplaintOverviewItem(
            id=c.id,
            case_id=c.case_id,
            category=c.category,
            status=c.status,
            assigned_desk=c.assigned_desk,
            description=decrypt_if_sensitive(c.category, c.description),
            is_escalated=c.is_escalated,
            escalated_at=c.escalated_at,
            created_at=c.created_at,
            response_time_hours=_response_time_hours(c),
            timeline=[TimelineEventResponse.model_validate(event) for event in c.timeline_events],
        )
        for c in complaints
    ]


def _xlsx_response(filename: str, headers: list[str], rows: list[list[object]]) -> Response:
    content = build_xlsx(headers, rows)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export")
def export_complaints(
    db: DbSession,
    current_user: CurrentUser,
    category: ComplaintCategory | None = None,
) -> Response:
    """Executive Dashboard's "Export to Excel" — same summary-level fields
    Executives already see (no raw complaint text; that's never been part
    of this dashboard, and Whistleblow/Harassment text is sensitive).
    Respects the same category filter as /stats. Registered before
    /{complaint_id} for the same route-ordering reason as /stats above.
    """
    role_name = current_user.role.name
    if role_name not in ELEVATED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to export complaints")

    escalation_service.escalate_overdue_complaints(db)

    query = select(Complaint)
    if category is not None:
        query = query.where(Complaint.category == category.value)
    complaints = db.scalars(query.order_by(Complaint.created_at.desc())).all()

    headers = [
        "Case ID", "Category", "Status", "Assigned Desk", "Escalated",
        "Escalated At", "Submitted At", "Due At", "TAT (hours)",
    ]
    rows = [
        [
            c.case_id,
            c.category,
            c.status,
            c.assigned_desk or "Unassigned",
            "Yes" if c.is_escalated else "No",
            c.escalated_at.strftime("%Y-%m-%d %H:%M") if c.escalated_at else "",
            c.created_at.strftime("%Y-%m-%d %H:%M"),
            calculate_due_date(c.created_at, c.category).strftime("%Y-%m-%d %H:%M"),
            get_tat_hours(c.category),
        ]
        for c in complaints
    ]
    return _xlsx_response("uacms-complaints-export.xlsx", headers, rows)


@router.get("/admin-overview/export")
def export_admin_overview(
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("System Admin"))],
    category: ComplaintCategory | None = None,
) -> Response:
    """System Admin's downloadable record of every complaint — mirrors
    /admin-overview exactly, full description text included for every
    category. Registered before /{complaint_id} for the same
    route-ordering reason as /admin-overview above.
    """
    escalation_service.escalate_overdue_complaints(db)

    query = select(Complaint).options(joinedload(Complaint.timeline_events))
    if category is not None:
        query = query.where(Complaint.category == category.value)
    complaints = db.scalars(query.order_by(Complaint.created_at.desc())).unique().all()

    headers = [
        "Case ID", "Category", "Status", "Assigned Desk", "Description",
        "Escalated", "Escalated At", "Submitted At", "Response Time (hours)",
    ]
    rows = []
    for c in complaints:
        response_time = _response_time_hours(c)
        rows.append([
            c.case_id,
            c.category,
            c.status,
            c.assigned_desk or "Unassigned",
            decrypt_if_sensitive(c.category, c.description),
            "Yes" if c.is_escalated else "No",
            c.escalated_at.strftime("%Y-%m-%d %H:%M") if c.escalated_at else "",
            c.created_at.strftime("%Y-%m-%d %H:%M"),
            response_time if response_time is not None else "",
        ])
    return _xlsx_response("uacms-admin-complaints-export.xlsx", headers, rows)


@router.get("/{complaint_id}", response_model=ComplaintDetailResponse)
def get_complaint(complaint_id: int, db: DbSession, current_user: CurrentUser) -> ComplaintDetailResponse:
    complaint = db.scalar(
        select(Complaint)
        .options(joinedload(Complaint.attachments), joinedload(Complaint.timeline_events), joinedload(Complaint.complainant))
        .where(Complaint.id == complaint_id)
    )
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    if escalation_service.escalate_overdue_complaints(db):
        db.refresh(complaint)

    role_name = current_user.role.name
    is_owner = complaint.complainant_id == current_user.id
    is_desk_owner = role_name == "Desk Owner" and complaint.assigned_to == current_user.id
    # System Admin previously excluded from encrypted Whistleblow/Harassment
    # content per the BRD's original permission table — reversed per HR
    # (M. Waqas) policy confirmation: "System Admin should have full rights,
    # with respect to view/review, change/edit, escalation/forwarding all."
    is_privileged = role_name in ELEVATED_ROLES
    if not (is_owner or is_desk_owner or is_privileged):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this complaint")

    return _to_detail_response(complaint)


@router.patch("/{complaint_id}/status", response_model=ComplaintDetailResponse)
def update_complaint_status(
    complaint_id: int,
    payload: ComplaintStatusUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> ComplaintDetailResponse:
    """Complaint status updates + investigation notes, both logged to the timeline.

    Open to the assigned Desk Owner (unchanged), plus System Admin on any
    complaint — per HR (M. Waqas) policy confirmation giving System Admin
    full edit rights, reversing the original desk-owner-only restriction.
    """
    complaint = db.scalar(
        select(Complaint)
        .options(joinedload(Complaint.attachments), joinedload(Complaint.timeline_events), joinedload(Complaint.complainant))
        .where(Complaint.id == complaint_id)
    )
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    role_name = current_user.role.name
    is_assigned_desk_owner = role_name == "Desk Owner" and complaint.assigned_to == current_user.id
    is_system_admin = role_name == "System Admin"
    if not (is_assigned_desk_owner or is_system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this complaint")

    new_status = payload.status.value
    if new_status != complaint.status:
        allowed_next = VALID_TRANSITIONS.get(complaint.status, set())
        if new_status not in allowed_next:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot move status from '{complaint.status}' to '{new_status}'",
            )
        db.add(
            ComplaintTimelineEvent(
                complaint_id=complaint.id,
                actor_id=current_user.id,
                event_type="status_change",
                from_status=complaint.status,
                to_status=new_status,
            )
        )
        complaint.status = new_status

    if payload.note:
        db.add(
            ComplaintTimelineEvent(
                complaint_id=complaint.id,
                actor_id=current_user.id,
                event_type="note",
                note=payload.note,
            )
        )

    db.commit()
    db.refresh(complaint)

    return _to_detail_response(complaint)


@router.post("/{complaint_id}/escalate", response_model=ComplaintDetailResponse)
def manually_escalate_complaint(
    complaint_id: int,
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("System Admin"))],
) -> ComplaintDetailResponse:
    """Manual escalation — System Admin can flag any complaint for
    management attention directly, independent of the automatic TAT-based
    escalation in app/services/escalation_service.py. Per HR (M. Waqas)
    policy confirmation granting System Admin escalation/forwarding rights.
    """
    complaint = db.scalar(
        select(Complaint)
        .options(joinedload(Complaint.attachments), joinedload(Complaint.timeline_events), joinedload(Complaint.complainant))
        .where(Complaint.id == complaint_id)
    )
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if complaint.is_escalated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Complaint is already escalated")

    now = datetime.now(timezone.utc)
    complaint.is_escalated = True
    complaint.escalated_at = now
    db.add(
        ComplaintTimelineEvent(
            complaint_id=complaint.id,
            actor_id=current_user.id,
            event_type="escalation",
            note=f"Manually escalated by System Admin ({current_user.full_name}).",
        )
    )
    db.commit()
    db.refresh(complaint)

    return _to_detail_response(complaint)


@router.patch("/{complaint_id}/reassign", response_model=ComplaintDetailResponse)
def reassign_complaint(
    complaint_id: int,
    payload: ComplaintReassignRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("System Admin"))],
) -> ComplaintDetailResponse:
    """Forward a complaint to a different desk — System Admin only, per HR
    (M. Waqas) policy confirmation. Independent of the category-based
    auto-routing in assignment_service.assign(); this overrides it for a
    specific complaint without changing the category itself.
    """
    valid_desks = set(assignment_service.CATEGORY_DESK_MAPPING.values())
    if payload.desk not in valid_desks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown desk '{payload.desk}'. Valid desks: {', '.join(sorted(valid_desks))}",
        )

    complaint = db.scalar(
        select(Complaint)
        .options(joinedload(Complaint.attachments), joinedload(Complaint.timeline_events), joinedload(Complaint.complainant))
        .where(Complaint.id == complaint_id)
    )
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    old_desk = complaint.assigned_desk
    new_desk_owner = assignment_service.find_desk_owner(db, payload.desk)

    complaint.assigned_desk = payload.desk
    complaint.assigned_to = new_desk_owner.id if new_desk_owner else None
    db.add(
        ComplaintTimelineEvent(
            complaint_id=complaint.id,
            actor_id=current_user.id,
            event_type="note",
            note=f"Reassigned from {old_desk or 'Unassigned'} to {payload.desk} by System Admin ({current_user.full_name}).",
        )
    )
    db.commit()
    db.refresh(complaint)

    return _to_detail_response(complaint)


def _get_assigned_complaint_or_403(db: Session, complaint_id: int, current_user: User) -> Complaint:
    complaint = db.scalar(select(Complaint).where(Complaint.id == complaint_id))
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if complaint.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this complaint")
    return complaint


@router.get("/{complaint_id}/suggestions", response_model=SuggestionResponse)
def get_suggestions(
    complaint_id: int,
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("Desk Owner"))],
) -> SuggestionResponse:
    """Policy-Based AI Recommendation Engine — retrieval-only (no generation)
    against the fictional sample procedures, plus a human-authored
    "Recommended System Workflow" checklist paraphrased from that same text.
    """
    complaint = _get_assigned_complaint_or_403(db, complaint_id, current_user)
    description = decrypt_if_sensitive(complaint.category, complaint.description)
    result = suggestion_service.get_suggestions(db, complaint.category, description)
    return SuggestionResponse(
        suggestions=[SuggestionItem(**r) for r in result["suggestions"]],
        recommended_workflow=result["recommended_workflow"],
    )


@router.post("/{complaint_id}/suggestion-decision", response_model=ComplaintDetailResponse)
def record_suggestion_decision(
    complaint_id: int,
    payload: SuggestionDecisionRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(require_role("Desk Owner"))],
) -> ComplaintDetailResponse:
    """Log the desk owner's Accept/Modify/Override decision on a suggestion to the timeline."""
    if payload.action == "override" and not payload.justification:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Justification is required to override a suggestion")
    if payload.confidence in ("amber", "red") and not payload.justification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Justification is required for suggestions below high confidence",
        )

    complaint = db.scalar(
        select(Complaint)
        .options(joinedload(Complaint.attachments), joinedload(Complaint.timeline_events), joinedload(Complaint.complainant))
        .where(Complaint.id == complaint_id)
    )
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if complaint.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this complaint")

    action_label = {"accept": "accepted", "modify": "modified", "override": "overridden"}[payload.action]
    note = f"Suggestion {action_label} — {payload.clause}."
    if payload.justification:
        note += f" Justification: {payload.justification}"

    db.add(
        ComplaintTimelineEvent(
            complaint_id=complaint.id,
            actor_id=current_user.id,
            event_type="suggestion_decision",
            note=note,
            decision_action=payload.action,
        )
    )
    db.commit()
    db.refresh(complaint)

    return _to_detail_response(complaint)
