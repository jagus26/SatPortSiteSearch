import uuid
from typing import Any, Optional

from pydantic import BaseModel

from app.models.score import ScoreCategory


class ScoreCreate(BaseModel):
    category: ScoreCategory
    raw_score: int
    data_json: dict[str, Any] = {}
    source: Optional[str] = None


class ScoreRead(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    category: ScoreCategory
    raw_score: int
    data_json: dict[str, Any]
    source: Optional[str]


class CompositeResponse(BaseModel):
    site_id: uuid.UUID
    composite: Optional[float]
    scores: dict[str, int]
