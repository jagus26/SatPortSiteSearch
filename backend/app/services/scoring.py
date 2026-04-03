import uuid
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.score import SiteScore


async def compute_composite(
    session: AsyncSession,
    site_id: uuid.UUID,
    weights: dict[str, float],
) -> dict[str, Any]:
    result = await session.execute(
        select(SiteScore).where(SiteScore.site_id == site_id)
    )
    site_scores = result.scalars().all()

    if not site_scores:
        return {"composite": None, "scores": {}}

    scores_by_category = {s.category.value: s.raw_score for s in site_scores}

    weighted_sum = 0.0
    weight_total = 0.0
    for category, weight in weights.items():
        if category in scores_by_category:
            weighted_sum += scores_by_category[category] * weight
            weight_total += weight

    composite = weighted_sum / weight_total if weight_total > 0 else None

    return {
        "composite": round(composite, 2) if composite is not None else None,
        "scores": scores_by_category,
    }
