import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.site import SiteStatus


class SiteCreate(BaseModel):
    name: str
    slug: str
    latitude: float
    longitude: float
    status: SiteStatus = SiteStatus.candidate
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    notes: Optional[str] = None


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[SiteStatus] = None
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    notes: Optional[str] = None


class SiteRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    latitude: float
    longitude: float
    status: SiteStatus
    region: Optional[str]
    country: Optional[str]
    country_code: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
