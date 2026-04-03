import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Column
from sqlmodel import Field, SQLModel


class SiteStatus(str, enum.Enum):
    candidate = "candidate"
    under_review = "under-review"
    approved = "approved"
    rejected = "rejected"


class Site(SQLModel, table=True):
    __tablename__ = "sites"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    slug: str = Field(index=True, unique=True)
    latitude: float
    longitude: float
    status: SiteStatus = Field(default=SiteStatus.candidate)
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = Field(default=None, max_length=2)
    notes: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
