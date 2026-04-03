import uuid
from typing import Optional

from pydantic import BaseModel

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.internal


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    customer_id: Optional[uuid.UUID]
