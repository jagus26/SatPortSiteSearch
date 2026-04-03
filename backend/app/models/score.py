import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON, DateTime


class ScoreCategory(str, enum.Enum):
    connectivity = "connectivity"
    rf_satellite = "rf_satellite"
    infrastructure = "infrastructure"
    regulatory = "regulatory"
    environmental = "environmental"
    geopolitical = "geopolitical"


class SiteScore(SQLModel, table=True):
    __tablename__ = "site_scores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    site_id: uuid.UUID = Field(foreign_key="sites.id", index=True)
    category: ScoreCategory
    raw_score: int = Field(ge=0, le=100)
    data_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    source: Optional[str] = None
    last_updated: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
