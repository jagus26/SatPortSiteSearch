import httpx
import pytest

from app.adapters.base import AdapterResult
from app.adapters.nasa_power import NasaPowerAdapter


def make_nasa_response():
    """Fake NASA POWER API response for a single point."""
    return {
        "properties": {
            "parameter": {
                "T2M": {"2023": 25.3},
                "PRECTOTCORR": {"2023": 4.2},
                "ALLSKY_SFC_SW_DWN": {"2023": 5.1},
                "WS10M": {"2023": 3.8},
            }
        }
    }


async def test_adapter_result_structure():
    result = AdapterResult(
        raw_score=75,
        data_json={"temp_c": 25.3},
        source="nasa_power",
    )
    assert result.raw_score == 75
    assert result.data_json["temp_c"] == 25.3
    assert result.source == "nasa_power"


async def test_nasa_power_fetch(monkeypatch):
    adapter = NasaPowerAdapter()

    async def mock_get(self, url, **kwargs):
        return httpx.Response(200, json=make_nasa_response(), request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    result = await adapter.fetch(latitude=-23.55, longitude=-46.63)
    assert isinstance(result, AdapterResult)
    assert 0 <= result.raw_score <= 100
    assert "avg_temp_c" in result.data_json
    assert "avg_precipitation_mm" in result.data_json
    assert "avg_solar_kwh_m2" in result.data_json
    assert "avg_wind_speed_ms" in result.data_json
    assert result.source == "nasa_power"


async def test_nasa_power_scoring_logic():
    adapter = NasaPowerAdapter()

    # Ideal conditions: moderate temp, low precip, high solar, low wind
    score = adapter.compute_score(
        avg_temp_c=22.0,
        avg_precipitation_mm=1.5,
        avg_solar_kwh_m2=5.5,
        avg_wind_speed_ms=3.0,
    )
    assert 70 <= score <= 100

    # Harsh conditions: extreme temp, heavy rain, low solar, high wind
    score_harsh = adapter.compute_score(
        avg_temp_c=45.0,
        avg_precipitation_mm=10.0,
        avg_solar_kwh_m2=1.0,
        avg_wind_speed_ms=15.0,
    )
    assert score_harsh < score
