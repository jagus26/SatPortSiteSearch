import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.site import Site
from app.models.score import SiteScore
from app.schemas.score import ScoreCreate, CompositeResponse
from app.services.scoring import compute_composite, enrich_site

router = APIRouter(prefix="/api/sites/{site_id}/scores", tags=["scores"])

DEFAULT_WEIGHTS = {
    "connectivity": 1.0,
    "rf_satellite": 1.0,
    "infrastructure": 1.0,
    "regulatory": 1.0,
    "environmental": 1.0,
    "geopolitical": 1.0,
}


@router.post("", status_code=201)
async def add_score(
    site_id: uuid.UUID,
    body: ScoreCreate,
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    score = SiteScore(site_id=site_id, **body.model_dump())
    session.add(score)
    await session.commit()
    await session.refresh(score)
    return score


@router.get("", response_model=CompositeResponse)
async def get_scores(
    site_id: uuid.UUID,
    weights: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    w = json.loads(weights) if weights else DEFAULT_WEIGHTS
    result = await compute_composite(session, site_id, w)
    return CompositeResponse(site_id=site_id, **result)


@router.post("/enrich", response_model=CompositeResponse)
async def enrich(
    site_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    result = await enrich_site(session, site_id, DEFAULT_WEIGHTS)
    return CompositeResponse(site_id=site_id, **result)
