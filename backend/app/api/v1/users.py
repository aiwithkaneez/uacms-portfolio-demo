import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.db.database import get_db
from app.dependencies.auth import require_role
from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserCreateRequest, UserCreateResponse, UserListItem, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["Users"])
DbSession = Annotated[Session, Depends(get_db)]
SystemAdmin = Annotated[User, Depends(require_role("System Admin"))]


def _get_role_or_400(db: Session, role_name: str) -> Role:
    role = db.scalar(select(Role).where(Role.name == role_name))
    if role is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown role '{role_name}'")
    return role


def _to_list_item(user: User) -> UserListItem:
    return UserListItem(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        assigned_desk=user.assigned_desk,
        is_active=user.is_active,
    )


@router.get("", response_model=list[UserListItem])
def list_users(db: DbSession, _current_user: SystemAdmin) -> list[UserListItem]:
    users = db.scalars(select(User).options(joinedload(User.role)).order_by(User.full_name)).all()
    return [_to_list_item(u) for u in users]


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreateRequest, db: DbSession, _current_user: SystemAdmin) -> UserCreateResponse:
    if db.scalar(select(User).where(User.email == str(payload.email))) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    role = _get_role_or_400(db, payload.role)
    temp_password = secrets.token_urlsafe(9)

    user = User(
        full_name=payload.full_name,
        email=str(payload.email),
        hashed_password=hash_password(temp_password),
        role_id=role.id,
        assigned_desk=payload.assigned_desk,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserCreateResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=role.name,
        assigned_desk=user.assigned_desk,
        is_active=user.is_active,
        temp_password=temp_password,
    )


@router.patch("/{user_id}", response_model=UserListItem)
def update_user(user_id: int, payload: UserUpdateRequest, db: DbSession, _current_user: SystemAdmin) -> UserListItem:
    user = db.scalar(select(User).options(joinedload(User.role)).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.role is not None:
        user.role = _get_role_or_400(db, payload.role)
    if payload.assigned_desk is not None:
        user.assigned_desk = payload.assigned_desk
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return _to_list_item(user)
