import httpx

from app.adapters.base import AdapterResult, BaseAdapter
from app.models.score import ScoreCategory


class NasaPowerAdapter(BaseAdapter):
    category = ScoreCategory.environmental

    API_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        params = {
            "parameters": "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M",
            "community": "RE",
            "longitude": longitude,
            "latitude": latitude,
            "format": "JSON",
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(self.API_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

        params_data = data["properties"]["parameter"]

        # Extract annual averages (use the last available year key)
        avg_temp = self._last_value(params_data.get("T2M", {}))
        avg_precip = self._last_value(params_data.get("PRECTOTCORR", {}))
        avg_solar = self._last_value(params_data.get("ALLSKY_SFC_SW_DWN", {}))
        avg_wind = self._last_value(params_data.get("WS10M", {}))

        raw_score = self.compute_score(avg_temp, avg_precip, avg_solar, avg_wind)

        return AdapterResult(
            raw_score=raw_score,
            data_json={
                "avg_temp_c": avg_temp,
                "avg_precipitation_mm": avg_precip,
                "avg_solar_kwh_m2": avg_solar,
                "avg_wind_speed_ms": avg_wind,
            },
            source="nasa_power",
        )

    def compute_score(
        self,
        avg_temp_c: float,
        avg_precipitation_mm: float,
        avg_solar_kwh_m2: float,
        avg_wind_speed_ms: float,
    ) -> int:
        """Score 0-100 for ground station environmental suitability.

        Sub-weights (per design spec):
        - Temperature: 30% (ideal 15-25C, penalize extremes)
        - Precipitation: 30% (lower is better for RF/operations)
        - Solar availability: 20% (higher is better for off-grid power)
        - Wind: 20% (moderate is ok, extreme is bad for dish stability)
        """
        # Temperature score: 100 at 20C, drops toward 0 at -20C or 50C
        temp_score = max(0, 100 - abs(avg_temp_c - 20) * 3.3)

        # Precipitation: 100 at 0mm/day, 0 at 10mm/day
        precip_score = max(0, 100 - avg_precipitation_mm * 10)

        # Solar: 100 at 6+ kWh/m2/day, 0 at 0
        solar_score = min(100, avg_solar_kwh_m2 * 100 / 6)

        # Wind: 100 at 0-5 m/s, drops to 0 at 20 m/s
        if avg_wind_speed_ms <= 5:
            wind_score = 100
        else:
            wind_score = max(0, 100 - (avg_wind_speed_ms - 5) * 6.67)

        composite = (
            temp_score * 0.30
            + precip_score * 0.30
            + solar_score * 0.20
            + wind_score * 0.20
        )
        return round(min(100, max(0, composite)))

    @staticmethod
    def _last_value(param_dict: dict) -> float:
        if not param_dict:
            return 0.0
        last_key = list(param_dict.keys())[-1]
        return float(param_dict[last_key])
