import httpx
import math

from app.adapters.base import AdapterResult
from app.adapters.peeringdb import PeeringDbAdapter


def make_peeringdb_response():
    """Fake PeeringDB API response with IXPs near Sao Paulo."""
    return {
        "data": [
            {
                "id": 1,
                "name": "IX.br (PTT.br) Sao Paulo",
                "latitude": -23.5505,
                "longitude": -46.6333,
            },
            {
                "id": 2,
                "name": "IX.br (PTT.br) Campinas",
                "latitude": -22.9099,
                "longitude": -47.0626,
            },
            {
                "id": 3,
                "name": "Far Away IX",
                "latitude": 40.7128,
                "longitude": -74.0060,
            },
        ]
    }


async def test_peeringdb_fetch(monkeypatch):
    adapter = PeeringDbAdapter()

    async def mock_get(self, url, **kwargs):
        return httpx.Response(200, json=make_peeringdb_response(), request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    result = await adapter.fetch(latitude=-23.55, longitude=-46.63)
    assert isinstance(result, AdapterResult)
    assert 0 <= result.raw_score <= 100
    assert "ixp_count_100km" in result.data_json
    assert "nearest_ixp_km" in result.data_json
    assert "nearest_ixp_name" in result.data_json
    assert result.source == "peeringdb"


async def test_peeringdb_nearby_filtering(monkeypatch):
    adapter = PeeringDbAdapter()

    async def mock_get(self, url, **kwargs):
        return httpx.Response(200, json=make_peeringdb_response(), request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    result = await adapter.fetch(latitude=-23.55, longitude=-46.63)
    # Sao Paulo and Campinas are within 100km; NYC is not
    assert result.data_json["ixp_count_100km"] == 2


async def test_peeringdb_scoring_logic():
    adapter = PeeringDbAdapter()

    # Close to IXPs = high score
    score_good = adapter.compute_score(ixp_count_100km=5, nearest_ixp_km=2.0)
    assert score_good >= 80

    # No IXPs nearby = low score
    score_bad = adapter.compute_score(ixp_count_100km=0, nearest_ixp_km=500.0)
    assert score_bad <= 30


async def test_haversine_distance():
    adapter = PeeringDbAdapter()
    # Sao Paulo to Campinas ~= 75-80km
    dist = adapter.haversine(-23.55, -46.63, -22.91, -47.06)
    assert 70 < dist < 90


async def test_peeringdb_no_ixps(monkeypatch):
    adapter = PeeringDbAdapter()

    async def mock_get(self, url, **kwargs):
        return httpx.Response(200, json={"data": []}, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    result = await adapter.fetch(latitude=0.0, longitude=0.0)
    assert result.data_json["ixp_count_100km"] == 0
    assert result.data_json["nearest_ixp_km"] is None
    assert result.raw_score <= 10
