from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint, ComplaintTimelineEvent
from app.services.assignment_service import calculate_due_date

ESCALATION_TRIGGER_STATUS = "new"


def escalate_overdue_complaints(db: Session) -> int:
    """BRD 3.4 Auto-Escalation: if a complaint's status hasn't moved off
    "new" within its TAT, flag it so Executives/System Admin see it in the
    escalated-complaints view without anyone needing to notice the overdue
    badge on their own dashboard first.

    No background worker in this deployment (Render free tier has neither
    a scheduler nor budget for one) — this runs as a cheap side effect of
    the read endpoints Executives and Desk Owners already hit constantly
    (dashboard stats, desk queue), scoped to just the "new" and
    not-yet-escalated rows so it stays fast regardless of table size.
    """
    now = datetime.now(timezone.utc)
    candidates = db.scalars(
        select(Complaint).where(
            Complaint.status == ESCALATION_TRIGGER_STATUS,
            Complaint.is_escalated.is_(False),
        )
    ).all()

    escalated_count = 0
    for complaint in candidates:
        if now <= calculate_due_date(complaint.created_at, complaint.category):
            continue
        complaint.is_escalated = True
        complaint.escalated_at = now
        db.add(
            ComplaintTimelineEvent(
                complaint_id=complaint.id,
                actor_id=None,
                event_type="escalation",
                note="Auto-escalated — status was still \"New\" after the TAT lapsed.",
            )
        )
        escalated_count += 1

    if escalated_count:
        db.commit()
    return escalated_count
