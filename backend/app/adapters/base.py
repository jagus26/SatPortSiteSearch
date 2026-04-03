from dataclasses import dataclass
from typing import Any

from app.models.score import ScoreCategory


@dataclass
class AdapterResult:
    raw_score: int
    data_json: dict[str, Any]
    source: str


class BaseAdapter:
    category: ScoreCategory

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        raise NotImplementedError
