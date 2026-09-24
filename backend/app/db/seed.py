from sqlalchemy import select

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.role import Role
from app.models.user import User

DEFAULT_PASSWORD = "Password123!"
ROLES = {
    "Employee": "Standard employee account.",
    "Desk Owner": "Owner of a complaint-handling desk.",
    "Executive": "Executive oversight account.",
    "Knowledge Base Admin": "Knowledge-base administration account.",
    "System Admin": "System administration account.",
}
DEMO_USERS = (
    ("Employee User", "employee@uacms.com", "Employee", None),
    ("Desk Owner User", "deskowner@uacms.com", "Desk Owner", "Operations"),
    ("Employee Relations Desk Owner", "hr.relations@uacms.com", "Desk Owner", "HR Employee Relations"),
    ("Learning Desk Owner", "hr.learning@uacms.com", "Desk Owner", "HR Learning"),
    ("FIU Desk Owner", "fiu@uacms.com", "Desk Owner", "FIU"),
    ("Executive User", "executive@uacms.com", "Executive", None),
    ("Knowledge Base Admin User", "kbadmin@uacms.com", "Knowledge Base Admin", None),
    ("System Admin User", "sysadmin@uacms.com", "System Admin", None),
)


def seed() -> None:
    with SessionLocal() as db:
        for name, description in ROLES.items():
            if db.scalar(select(Role).where(Role.name == name)) is None:
                db.add(Role(name=name, description=description))
        db.flush()
        roles_by_name = {role.name: role for role in db.scalars(select(Role)).all()}
        for full_name, email, role_name, assigned_desk in DEMO_USERS:
            if db.scalar(select(User).where(User.email == email)) is None:
                db.add(User(full_name=full_name, email=email, hashed_password=hash_password(DEFAULT_PASSWORD), role_id=roles_by_name[role_name].id, assigned_desk=assigned_desk, is_active=True))
        db.commit()


if __name__ == "__main__":
    seed()
