import uuid

from app.models.site import Site, SiteStatus
from app.models.score import SiteScore, ScoreCategory
from app.services.scoring import compute_composite


async def test_compute_composite_equal_weights(session):
    site = Site(
        name="Test Site",
        slug="scoring-test",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    scores = [
        SiteScore(site_id=site.id, category=ScoreCategory.connectivity, raw_score=80, source="test"),
        SiteScore(site_id=site.id, category=ScoreCategory.environmental, raw_score=60, source="test"),
    ]
    for s in scores:
        session.add(s)
    await session.commit()

    weights = {"connectivity": 1.0, "environmental": 1.0}
    result = await compute_composite(session, site.id, weights)
    assert result["composite"] == 70.0
    assert result["scores"]["connectivity"] == 80
    assert result["scores"]["environmental"] == 60


async def test_compute_composite_weighted(session):
    site = Site(
        name="Weighted Site",
        slug="weighted-test",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    scores = [
        SiteScore(site_id=site.id, category=ScoreCategory.connectivity, raw_score=100, source="test"),
        SiteScore(site_id=site.id, category=ScoreCategory.environmental, raw_score=0, source="test"),
    ]
    for s in scores:
        session.add(s)
    await session.commit()

    # connectivity weight 3x environmental
    weights = {"connectivity": 3.0, "environmental": 1.0}
    result = await compute_composite(session, site.id, weights)
    # (100*3 + 0*1) / (3+1) = 75.0
    assert result["composite"] == 75.0


async def test_compute_composite_no_scores(session):
    site = Site(
        name="Empty Site",
        slug="empty-test",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    weights = {"connectivity": 1.0}
    result = await compute_composite(session, site.id, weights)
    assert result["composite"] is None
    assert result["scores"] == {}


async def test_score_site_endpoint(client):
    create_resp = await client.post("/api/sites", json={
        "name": "API Score Test",
        "slug": "api-score-test",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    # Add a score directly via the scores endpoint
    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "connectivity",
        "raw_score": 90,
        "data_json": {"ixp_count": 5},
        "source": "peeringdb",
    })

    # Get composite with default equal weights
    response = await client.get(f"/api/sites/{site_id}/scores")
    assert response.status_code == 200
    data = response.json()
    assert data["composite"] == 90.0
    assert data["scores"]["connectivity"] == 90


async def test_score_site_with_custom_weights(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Weight Test",
        "slug": "weight-test",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "connectivity",
        "raw_score": 100,
        "source": "test",
    })
    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "environmental",
        "raw_score": 50,
        "source": "test",
    })

    response = await client.get(
        f"/api/sites/{site_id}/scores",
        params={"weights": '{"connectivity": 2.0, "environmental": 1.0}'},
    )
    assert response.status_code == 200
    data = response.json()
    # (100*2 + 50*1) / (2+1) = 83.33
    assert round(data["composite"], 2) == 83.33
