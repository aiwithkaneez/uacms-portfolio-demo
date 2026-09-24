from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class ComplaintCategory(str, Enum):
    GENERAL = "general"
    GRIEVANCE = "grievance"
    HARASSMENT = "harassment"
    WHISTLEBLOW = "whistleblow"


class ComplaintStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    content_type: str | None


class TimelineEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    note: str | None
    from_status: str | None
    to_status: str | None
    created_at: datetime


class ComplaintListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    is_anonymous: bool
    created_at: datetime


class DeskQueueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    is_anonymous: bool
    submitted_by: str
    created_at: datetime
    is_escalated: bool


class ComplaintDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    is_anonymous: bool
    description: str
    assigned_desk: str | None
    submitted_by: str
    # Only populated for a *disclosed* public (no-login) submission — null
    # for employee-portal complaints (no contact info collected there; the
    # account itself is the identity) and for anonymous public ones (the
    # whole point of choosing Anonymous is the desk owner doesn't get this).
    contact_phone: str | None = None
    contact_email: str | None = None
    submitter_employee_id: str | None = None
    tat_hours: int
    due_at: datetime
    is_escalated: bool
    escalated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentResponse] = Field(default_factory=list)
    timeline: list[TimelineEventResponse] = Field(default_factory=list)


class EscalatedComplaintItem(BaseModel):
    id: int
    case_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    assigned_desk: str | None
    created_at: datetime
    escalated_at: datetime | None
    # Full body + desk activity — per HR (M. Waqas) policy confirmation:
    # "executive should have access to full complaint body, delayed by
    # desk, responses by desk (if any)". Not from_attributes since
    # description needs decryption first (see list_escalated_complaints).
    description: str
    timeline: list[TimelineEventResponse] = Field(default_factory=list)


class AdminComplaintOverviewItem(BaseModel):
    id: int
    case_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    assigned_desk: str | None
    # Full text for every category, including Whistleblow/Harassment — per
    # HR (M. Waqas) policy confirmation, System Admin has full view/edit
    # rights over all complaints. Reverses the original BRD exclusion.
    description: str
    is_escalated: bool
    escalated_at: datetime | None
    created_at: datetime
    # Hours from submission to the first "New" -> "In Progress" transition,
    # i.e. how long it sat before a desk owner actually picked it up. Null
    # if that hasn't happened yet.
    response_time_hours: float | None
    # Full activity log — status changes, investigation notes, and
    # suggestion decisions — same per HR directive as the description above.
    timeline: list[TimelineEventResponse] = Field(default_factory=list)


class ComplaintStatusUpdateRequest(BaseModel):
    status: ComplaintStatus
    note: str | None = Field(default=None, max_length=2000)


class ComplaintReassignRequest(BaseModel):
    desk: str = Field(min_length=1, max_length=50)


class ComplaintCreateResponse(BaseModel):
    id: int
    case_id: str
    status: ComplaintStatus
    email_sent: bool = False
    notified_email: str | None = None


class PublicComplaintCreateRequest(BaseModel):
    """No-login complaint submission — open to anyone, not just employees.
    See app/api/v1/public_complaints.py for the rate limiting. At least one
    of phone/email is required (not both) — matches the status-lookup
    endpoint, which only ever needs one to match. Requiring both here would
    be more friction than the lookup itself needs.
    """

    description: str = Field(min_length=10, max_length=5000)
    category: ComplaintCategory
    is_employee: bool = False
    employee_id: str | None = Field(default=None, pattern=r"^\d{5}$")
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    email: EmailStr | None = None
    # Same meaning as the employee-portal toggle: whether the desk owner
    # sees contact info (Disclosed) or not (Anonymous). Either way the
    # complainant can still use case_id + phone/email to check status
    # themselves — this only controls what the DESK OWNER sees.
    is_anonymous: bool = False

    @model_validator(mode="after")
    def _employee_id_matches_toggle(self) -> "PublicComplaintCreateRequest":
        if self.is_employee and not self.employee_id:
            raise ValueError("employee_id is required when is_employee is true")
        if not self.is_employee and self.employee_id:
            raise ValueError("employee_id must be omitted when is_employee is false")
        if not self.phone and not self.email:
            raise ValueError("Provide a phone number or email so you can check status later")
        return self


class PublicComplaintCreateResponse(BaseModel):
    case_id: str
    email_sent: bool = False
    notified_email: str | None = None


class PublicComplaintStatusRequest(BaseModel):
    case_id: str
    # Either proves ownership — matched against whichever contact fields
    # were captured at submission time. Both optional here so the request
    # doesn't force a user who only remembers one to fill in a fake value
    # for the other; the endpoint itself requires at least one.
    phone: str | None = None
    email: EmailStr | None = None

    @model_validator(mode="after")
    def _at_least_one_contact(self) -> "PublicComplaintStatusRequest":
        if not self.phone and not self.email:
            raise ValueError("Provide phone or email to look up a complaint")
        return self


class PublicTimelineEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_type: str
    from_status: str | None
    to_status: str | None
    created_at: datetime


class PublicComplaintStatusResponse(BaseModel):
    case_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    created_at: datetime
    due_at: datetime
    timeline: list[PublicTimelineEventResponse]


class CategoryCheckRequest(BaseModel):
    description: str = Field(min_length=10)
    category: ComplaintCategory


class CategoryCheckResponse(BaseModel):
    # Null when no mismatch is detected — the common case. Never blocks
    # submission; see suggestion_service.check_category_mismatch.
    suggested_category: ComplaintCategory | None = None
    confidence: str | None = None


class SuggestionItem(BaseModel):
    source: str
    clause: str
    text: str
    score: float
    confidence: str
    why_matched: str
    # True only for the one clause guaranteed to appear regardless of its
    # similarity score (see suggestion_service.get_suggestions). The
    # frontend uses this to show a distinct "Standard Procedure" badge
    # instead of the similarity-based confidence badge — this clause isn't
    # weakly matched, it's deliberately always included, and reusing the
    # same green/amber/red vocabulary for both was misleading.
    is_guaranteed: bool


class RecommendedWorkflowStep(BaseModel):
    title: str
    source: str


class SuggestionResponse(BaseModel):
    suggestions: list[SuggestionItem]
    # Human-authored paraphrase of the same retrieved policy text, not a
    # separate claim — see app/data/action_knowledge_base.py. Empty for
    # categories with no policy corpus (e.g. General).
    recommended_workflow: list[RecommendedWorkflowStep]


class SuggestionDecisionRequest(BaseModel):
    action: str = Field(pattern="^(accept|modify|override)$")
    clause: str = Field(max_length=255)
    confidence: str = Field(pattern="^(green|amber|red|none)$")
    justification: str | None = Field(default=None, max_length=2000)


class SuggestionStatsResponse(BaseModel):
    total_decisions: int
    accepted: int
    modified: int
    overridden: int
    accepted_percent: float
    modified_percent: float
    overridden_percent: float


class CategoryBreakdown(BaseModel):
    labels: list[str]
    data: list[int]


class StatusBreakdown(BaseModel):
    labels: list[str]
    data: list[int]


class TatComplianceBreakdown(BaseModel):
    within_tat_percent: float
    overdue_percent: float


class DashboardStatsResponse(BaseModel):
    total_complaints: int
    open_count: int
    resolved: int
    avg_resolution_days: float | None
    by_category: CategoryBreakdown
    by_status: StatusBreakdown
    tat_compliance: TatComplianceBreakdown
    escalated_count: int