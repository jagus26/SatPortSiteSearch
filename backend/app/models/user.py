import enum
import uuid
from typing import Optional

from sqlmodel import Field, SQLModel


class UserRole(str, enum.Enum):
    internal = "internal"
    customer = "customer"


class Customer(SQLModel, table=True):
    __tablename__ = "customers"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: UserRole = Field(default=UserRole.internal)
    customer_id: Optional[uuid.UUID] = Field(default=None, foreign_key="customers.id")
