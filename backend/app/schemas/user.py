from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    assigned_desk: str | None
    is_active: bool


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    assigned_desk: str | None
    is_active: bool


class UserCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    role: str
    assigned_desk: str | None = None


class UserCreateResponse(UserListItem):
    temp_password: str


class UserUpdateRequest(BaseModel):
    role: str | None = None
    assigned_desk: str | None = None
    is_active: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
