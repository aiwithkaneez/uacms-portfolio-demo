from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)

    # NULL when the complaint is anonymous, even though a logged-in user submitted it.
    # Also NULL for public submissions (no account exists at all).
    complainant_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    # "employee_portal" (existing authenticated flow) or "public" (no-login
    # flow — see app/api/v1/public_complaints.py). Kept separate from
    # is_anonymous, which only describes the employee-portal identity-toggle.
    submission_source: Mapped[str] = mapped_column(String(20), default="employee_portal", server_default="employee_portal", nullable=False)

    # Contact info for public (no-login) submissions only — how the
    # complainant proves ownership when checking status later, since they
    # have no account. Encrypted at rest for Whistleblow/Harassment same as
    # `description` (see app/core/encryption.py) — a whistleblower's phone
    # number deserves the same protection as their complaint text.
    contact_phone: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 5-digit ID, captured as free text (no employee registry exists to
    # validate against) — set only when the public submitter checks
    # "I'm an employee".
    submitter_employee_id: Mapped[str | None] = mapped_column(String(5), nullable=True)

    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Temporary manual category selection (Week 2). Replaced by AI classification in Week 3.
    category: Mapped[str] = mapped_column(String(20), nullable=False)

    assigned_desk: Mapped[str | None] = mapped_column(String(50), nullable=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new", nullable=False)

    # Auto-escalation (BRD 3.4): flipped true when a complaint's status is
    # still "new" past its TAT — see app/services/escalation_service.py.
    # Never cleared back to false, even if the desk owner later moves it
    # along; it's a historical fact that this complaint missed its TAT.
    is_escalated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    complainant: Mapped["User | None"] = relationship(foreign_keys=[complainant_id])
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assigned_to])
    attachments: Mapped[list["ComplaintAttachment"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")
    timeline_events: Mapped[list["ComplaintTimelineEvent"]] = relationship(
        back_populates="complaint", cascade="all, delete-orphan", order_by="ComplaintTimelineEvent.created_at"
    )


class ComplaintAttachment(Base):
    __tablename__ = "complaint_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    complaint: Mapped["Complaint"] = relationship(back_populates="attachments")


class ComplaintTimelineEvent(Base):
    __tablename__ = "complaint_timeline_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # "status_change", "note", "suggestion_decision", or "escalation"
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # "accept" / "modify" / "override" — set only on suggestion_decision events,
    # kept as a structured column (not parsed out of `note`) so the suggestion
    # engine's acceptance rate can be aggregated reliably.
    decision_action: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    complaint: Mapped["Complaint"] = relationship(back_populates="timeline_events")
    actor: Mapped["User | None"] = relationship()
