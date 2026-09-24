from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint
from app.models.role import Role
from app.models.user import User
from app.schemas.complaint import ComplaintCategory

DESK_OWNER_ROLE_NAME = "Desk Owner"
CASE_ID_PREFIX = "C-"
CASE_ID_START = 1000

CATEGORY_DESK_MAPPING: dict[ComplaintCategory, str] = {
    ComplaintCategory.GENERAL: "Operations",
    ComplaintCategory.GRIEVANCE: "HR Employee Relations",
    ComplaintCategory.HARASSMENT: "HR Learning",
    ComplaintCategory.WHISTLEBLOW: "FIU",
}
CATEGORY_TAT_MAPPING: dict[ComplaintCategory, int] = {
    ComplaintCategory.GENERAL: 24,
    ComplaintCategory.GRIEVANCE: 72,
    ComplaintCategory.HARASSMENT: 24,
    ComplaintCategory.WHISTLEBLOW: 48,
}

def resolve_desk(category: ComplaintCategory) -> str:
    """Map a complaint category to its owning desk."""
    desk = CATEGORY_DESK_MAPPING.get(category)
    if desk is None:
        raise ValueError(f"No desk mapping configured for category '{category}'")
    return desk


def find_desk_owner(db: Session, desk: str) -> User | None:
    return db.scalar(
        select(User)
        .join(Role, Role.id == User.role_id)
        .where(
            Role.name == DESK_OWNER_ROLE_NAME,
            func.lower(User.assigned_desk) == desk.lower(),
            User.is_active.is_(True),
        )
    )


def assign(db: Session, category: ComplaintCategory) -> tuple[str, User | None]:
    """
    Full assignment workflow for a new complaint.

    Returns (assigned_desk, desk_owner_or_None).
    Callers are responsible for handling the case where no Desk Owner
    is found (assigned_to stays NULL — complaint is still saved).
    """
    desk = resolve_desk(category)
    desk_owner = find_desk_owner(db, desk)
    return desk, desk_owner


def generate_case_id(db: Session) -> str:
    """C-1000, C-1001, ... based on how many complaints exist so far.

    Shared between the authenticated and public (no-login) submission
    routers so both flows produce case IDs from the same sequence.
    Generated before insert so we never park a row on the unique
    `PENDING` placeholder (that collided under concurrent submits).
    """
    last_id = db.scalar(select(func.max(Complaint.id))) or 0
    next_number = CASE_ID_START + last_id
    case_id = f"{CASE_ID_PREFIX}{next_number}"
    while db.scalar(select(Complaint.id).where(Complaint.case_id == case_id)) is not None:
        next_number += 1
        case_id = f"{CASE_ID_PREFIX}{next_number}"
    return case_id


def get_tat_hours(category: str) -> int:
    """
    Return turnaround time (TAT) in hours for a complaint category.
    """

    for key, value in CATEGORY_TAT_MAPPING.items():
        if key.value == category:
            return value

    return 24


def calculate_due_date(created_at: datetime, category: str) -> datetime:
    """
    Calculate due date from complaint creation time.
    """

    tat = get_tat_hours(category)

    return created_at + timedelta(hours=tat)