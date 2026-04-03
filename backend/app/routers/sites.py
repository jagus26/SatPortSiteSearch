import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.site import Site
from app.schemas.site import SiteCreate, SiteUpdate, SiteRead

router = APIRouter(prefix="/api/sites", tags=["sites"])


@router.post("", response_model=SiteRead, status_code=201)
async def create_site(body: SiteCreate, session: AsyncSession = Depends(get_session)):
    site = Site(**body.model_dump())
    session.add(site)
    await session.commit()
    await session.refresh(site)
    return site


@router.get("", response_model=list[SiteRead])
async def list_sites(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Site))
    return result.scalars().all()


@router.get("/{site_id}", response_model=SiteRead)
async def get_site(site_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.patch("/{site_id}", response_model=SiteRead)
async def update_site(
    site_id: uuid.UUID,
    body: SiteUpdate,
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(site, key, value)
    site.updated_at = datetime.now(timezone.utc)
    session.add(site)
    await session.commit()
    await session.refresh(site)
    return site


@router.delete("/{site_id}", status_code=204)
async def delete_site(site_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    await session.delete(site)
    await session.commit()
