import math
from typing import Optional

import httpx

from app.adapters.base import AdapterResult, BaseAdapter
from app.models.score import ScoreCategory


class PeeringDbAdapter(BaseAdapter):
    category = ScoreCategory.connectivity

    API_URL = "https://www.peeringdb.com/api/ix"

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        async with httpx.AsyncClient() as client:
            response = await client.get(self.API_URL, timeout=30)
            response.raise_for_status()
            data = response.json()

        ixps = data.get("data", [])

        # Calculate distances and filter nearby IXPs
        nearby = []
        nearest_km: Optional[float] = None
        nearest_name: Optional[str] = None

        for ix in ixps:
            ix_lat = ix.get("latitude")
            ix_lon = ix.get("longitude")
            if ix_lat is None or ix_lon is None:
                continue

            dist = self.haversine(latitude, longitude, ix_lat, ix_lon)

            if nearest_km is None or dist < nearest_km:
                nearest_km = dist
                nearest_name = ix.get("name", "Unknown")

            if dist <= 100:
                nearby.append({"name": ix.get("name"), "distance_km": round(dist, 1)})

        raw_score = self.compute_score(
            ixp_count_100km=len(nearby),
            nearest_ixp_km=nearest_km,
        )

        return AdapterResult(
            raw_score=raw_score,
            data_json={
                "ixp_count_100km": len(nearby),
                "nearest_ixp_km": round(nearest_km, 1) if nearest_km is not None else None,
                "nearest_ixp_name": nearest_name,
                "nearby_ixps": nearby[:10],
            },
            source="peeringdb",
        )

    def compute_score(self, ixp_count_100km: int, nearest_ixp_km: Optional[float]) -> int:
        """Score 0-100 for connectivity suitability.

        Sub-weights (per design spec):
        - Number of IXPs within 100km: 50%
        - Distance to nearest IXP: 50%
        """
        # IXP count score: 100 at 5+, 0 at 0
        count_score = min(100, ixp_count_100km * 20)

        # Distance score: 100 at 0km, 0 at 500km+
        if nearest_ixp_km is None:
            dist_score = 0
        else:
            dist_score = max(0, 100 - nearest_ixp_km * 0.2)

        composite = count_score * 0.50 + dist_score * 0.50
        return round(min(100, max(0, composite)))

    @staticmethod
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in km between two lat/lon points."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
