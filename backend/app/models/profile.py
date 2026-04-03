import enum
import uuid
from typing import Any, Optional

from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON


class OwnerType(str, enum.Enum):
    system = "system"
    team = "team"
    customer = "customer"


class ScoreProfile(SQLModel, table=True):
    __tablename__ = "score_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    description: Optional[str] = None
    weights_json: dict[str, float] = Field(
        default_factory=lambda: {
            "connectivity": 1.0,
            "rf_satellite": 1.0,
            "infrastructure": 1.0,
            "regulatory": 1.0,
            "environmental": 1.0,
            "geopolitical": 1.0,
        },
        sa_column=Column(JSON),
    )
    owner_type: OwnerType = Field(default=OwnerType.team)
