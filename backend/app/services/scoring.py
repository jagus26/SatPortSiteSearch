import asyncio
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.score import SiteScore
from app.models.site import Site
from app.adapters.nasa_power import NasaPowerAdapter
from app.adapters.peeringdb import PeeringDbAdapter


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
        return {"composite": None, "scores": {}, "details": {}}

    scores_by_category = {s.category.value: s.raw_score for s in site_scores}
    details_by_category = {
        s.category.value: {
            "raw_score": s.raw_score,
            "data_json": s.data_json,
            "source": s.source,
        }
        for s in site_scores
    }

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
        "details": details_by_category,
    }


ADAPTERS = [NasaPowerAdapter(), PeeringDbAdapter()]


async def enrich_site(
    session: AsyncSession,
    site_id: uuid.UUID,
    weights: dict[str, float],
) -> dict[str, Any] | None:
    site = await session.get(Site, site_id)
    if not site:
        return None

    # Run all adapters concurrently
    results = await asyncio.gather(
        *[adapter.fetch(latitude=site.latitude, longitude=site.longitude) for adapter in ADAPTERS],
        return_exceptions=True,
    )

    for adapter, result in zip(ADAPTERS, results):
        if isinstance(result, Exception):
            continue

        # Upsert: find existing score for this site+category, update or create
        existing = await session.execute(
            select(SiteScore).where(
                SiteScore.site_id == site_id,
                SiteScore.category == adapter.category,
            )
        )
        existing_score = existing.scalars().first()

        if existing_score:
            existing_score.raw_score = result.raw_score
            existing_score.data_json = result.data_json
            existing_score.source = result.source
            session.add(existing_score)
        else:
            new_score = SiteScore(
                site_id=site_id,
                category=adapter.category,
                raw_score=result.raw_score,
                data_json=result.data_json,
                source=result.source,
            )
            session.add(new_score)

    await session.commit()

    return await compute_composite(session, site_id, weights)
