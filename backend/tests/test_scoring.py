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


async def test_scores_include_details(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Details Test",
        "slug": "details-test",
        "latitude": -23.55,
        "longitude": -46.63,
    })
    site_id = create_resp.json()["id"]

    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "connectivity",
        "raw_score": 85,
        "data_json": {"ixp_count_100km": 3, "nearest_ixp_km": 12.5},
        "source": "peeringdb",
    })

    response = await client.get(f"/api/sites/{site_id}/scores")
    assert response.status_code == 200
    data = response.json()
    assert "details" in data
    assert "connectivity" in data["details"]
    assert data["details"]["connectivity"]["raw_score"] == 85
    assert data["details"]["connectivity"]["data_json"]["ixp_count_100km"] == 3
    assert data["details"]["connectivity"]["source"] == "peeringdb"


async def test_enrich_site(client, monkeypatch):
    import httpx
    from app.adapters.nasa_power import NasaPowerAdapter
    from app.adapters.peeringdb import PeeringDbAdapter

    create_resp = await client.post("/api/sites", json={
        "name": "Enrich Test",
        "slug": "enrich-test",
        "latitude": -23.55,
        "longitude": -46.63,
    })
    site_id = create_resp.json()["id"]

    # Mock NASA POWER API
    nasa_response = {
        "properties": {
            "parameter": {
                "T2M": {"2023": 20.0},
                "PRECTOTCORR": {"2023": 2.0},
                "ALLSKY_SFC_SW_DWN": {"2023": 5.0},
                "WS10M": {"2023": 3.0},
            }
        }
    }

    # Mock PeeringDB API
    peeringdb_response = {
        "data": [
            {"id": 1, "name": "Test IX", "latitude": -23.55, "longitude": -46.63},
        ]
    }

    async def mock_get(self, url, **kwargs):
        if "power.larc.nasa.gov" in str(url):
            return httpx.Response(200, json=nasa_response, request=httpx.Request("GET", url))
        else:
            return httpx.Response(200, json=peeringdb_response, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    response = await client.post(f"/api/sites/{site_id}/scores/enrich")
    assert response.status_code == 200
    data = response.json()
    assert data["composite"] is not None
    assert "environmental" in data["scores"]
    assert "connectivity" in data["scores"]
    assert "environmental" in data["details"]
    assert "connectivity" in data["details"]


async def test_enrich_site_upserts(client, monkeypatch):
    import httpx

    create_resp = await client.post("/api/sites", json={
        "name": "Upsert Test",
        "slug": "upsert-test",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    # Add an existing score
    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "environmental",
        "raw_score": 50,
        "source": "old",
    })

    # Mock adapters
    nasa_response = {
        "properties": {
            "parameter": {
                "T2M": {"2023": 20.0},
                "PRECTOTCORR": {"2023": 2.0},
                "ALLSKY_SFC_SW_DWN": {"2023": 5.0},
                "WS10M": {"2023": 3.0},
            }
        }
    }
    peeringdb_response = {"data": []}

    async def mock_get(self, url, **kwargs):
        if "power.larc.nasa.gov" in str(url):
            return httpx.Response(200, json=nasa_response, request=httpx.Request("GET", url))
        else:
            return httpx.Response(200, json=peeringdb_response, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    response = await client.post(f"/api/sites/{site_id}/scores/enrich")
    assert response.status_code == 200
    data = response.json()
    # Environmental score should be updated (not 50 anymore)
    assert data["details"]["environmental"]["source"] == "nasa_power"
    assert data["details"]["environmental"]["raw_score"] != 50


async def test_enrich_nonexistent_site(client):
    import uuid
    fake_id = uuid.uuid4()
    response = await client.post(f"/api/sites/{fake_id}/scores/enrich")
    assert response.status_code == 404
