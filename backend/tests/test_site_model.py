import uuid
from datetime import datetime, timezone

from sqlmodel import select

from app.models.site import Site, SiteStatus


async def test_create_site(session):
    site = Site(
        name="Test Ground Station",
        slug="test-ground-station",
        latitude=-23.5505,
        longitude=-46.6333,
        status=SiteStatus.candidate,
        region="South America",
        country="Brazil",
        country_code="BR",
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    assert site.id is not None
    assert isinstance(site.id, uuid.UUID)
    assert site.name == "Test Ground Station"
    assert site.status == SiteStatus.candidate
    assert site.created_at is not None


async def test_site_status_values():
    assert SiteStatus.candidate == "candidate"
    assert SiteStatus.under_review == "under-review"
    assert SiteStatus.approved == "approved"
    assert SiteStatus.rejected == "rejected"


async def test_query_site_by_country(session):
    site = Site(
        name="Sao Paulo",
        slug="sao-paulo",
        latitude=-23.5505,
        longitude=-46.6333,
        status=SiteStatus.candidate,
        country="Brazil",
        country_code="BR",
    )
    session.add(site)
    await session.commit()

    result = await session.execute(select(Site).where(Site.country_code == "BR"))
    found = result.scalars().first()
    assert found is not None
    assert found.name == "Sao Paulo"


from app.models.score import SiteScore, ScoreCategory


async def test_create_site_score(session):
    site = Site(
        name="Test Site",
        slug="test-site-score",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    score = SiteScore(
        site_id=site.id,
        category=ScoreCategory.connectivity,
        raw_score=85,
        data_json={"ixp_count": 3, "nearest_fiber_km": 12.5},
        source="peeringdb",
    )
    session.add(score)
    await session.commit()
    await session.refresh(score)

    assert score.id is not None
    assert score.raw_score == 85
    assert score.category == ScoreCategory.connectivity
    assert score.data_json["ixp_count"] == 3


async def test_score_categories():
    categories = [c.value for c in ScoreCategory]
    assert "connectivity" in categories
    assert "rf_satellite" in categories
    assert "infrastructure" in categories
    assert "regulatory" in categories
    assert "environmental" in categories
    assert "geopolitical" in categories
