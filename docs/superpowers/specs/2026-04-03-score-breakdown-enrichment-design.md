# Score Breakdown & Enrichment Trigger — Design Spec

## Purpose

Make scores actionable: let users trigger adapter enrichment from the UI and drill into the breakdown behind each category score. Currently scores must be added manually via API and the detail panel only shows the final number.

## Scope

- Expandable score bars showing metric breakdown with values, sub-scores, weights, and explanations
- "Fetch Scores" button that runs all adapters for a site and stores the results
- Loading states during enrichment (button spinner, score bar pulse)
- Pin color updates on map after enrichment

Out of scope: infrastructure adapter/overlay, per-category refresh buttons, score weight configuration, scheduled enrichment.

## Score Breakdown

### What the user sees

Clicking a score bar expands it to show a metrics table. Example for Environmental (score: 84):

```
Environmental                    ████████ 84
  ┌──────────────────────────────────────────┐
  │ Temperature    19.6°C  → 99  (30%)       │
  │   Ideal range for outdoor equipment      │
  │                                          │
  │ Precipitation  3.7mm   → 63  (30%)       │
  │   Lower is better for RF and operations  │
  │                                          │
  │ Solar          4.5 kWh → 75  (20%)       │
  │   Higher means off-grid power viable     │
  │                                          │
  │ Wind           3.5 m/s → 100 (20%)       │
  │   Moderate wind, good for dish stability │
  │                                          │
  │ Source: nasa_power                       │
  └──────────────────────────────────────────┘
```

Clicking again collapses it. Only one breakdown can be open at a time.

### Where the breakdown data comes from

The `data_json` field on SiteScore already stores the raw metric values (e.g., `{"avg_temp_c": 19.63, "avg_precipitation_mm": 3.7, ...}`). What's missing is the sub-score computation and explanations on the frontend side.

### Score metadata config

A shared TypeScript config defines the breakdown structure per category:

```typescript
{
  environmental: {
    metrics: [
      {
        key: "avg_temp_c",
        label: "Temperature",
        unit: "°C",
        weight: 0.30,
        explanation: "Ideal range for outdoor equipment",
        score: (value) => max(0, 100 - abs(value - 20) * 3.3)
      },
      ...
    ]
  },
  connectivity: {
    metrics: [
      {
        key: "ixp_count_100km",
        label: "IXPs within 100km",
        unit: "",
        weight: 0.50,
        explanation: "More exchange points means better connectivity options",
        score: (value) => min(100, value * 20)
      },
      ...
    ]
  }
}
```

This mirrors the scoring logic in the backend adapters. The sub-score functions are simple math — duplicating them on the frontend (rather than adding a new API) keeps the architecture simple and avoids an extra round trip.

### Metric definitions

**Environmental (NASA POWER):**

| Metric | Key | Unit | Weight | Explanation | Sub-score formula |
|--------|-----|------|--------|-------------|-------------------|
| Temperature | avg_temp_c | °C | 30% | Ideal range for outdoor equipment | 100 - |value - 20| * 3.3, min 0 |
| Precipitation | avg_precipitation_mm | mm/day | 30% | Lower is better for RF and operations | 100 - value * 10, min 0 |
| Solar | avg_solar_kwh_m2 | kWh/m²/day | 20% | Higher means off-grid power viable | value * 100 / 6, max 100 |
| Wind | avg_wind_speed_ms | m/s | 20% | Moderate wind, good for dish stability | 100 if ≤5, else 100 - (value-5) * 6.67, min 0 |

**Connectivity (PeeringDB):**

| Metric | Key | Unit | Weight | Explanation | Sub-score formula |
|--------|-----|------|--------|-------------|-------------------|
| IXPs within 100km | ixp_count_100km | count | 50% | More exchange points means better connectivity options | value * 20, max 100 |
| Nearest IXP | nearest_ixp_km | km | 50% | Closer IXPs mean lower latency and easier peering | 100 - value * 0.2, min 0 |

## Enrichment Trigger

### Backend endpoint

`POST /api/sites/{site_id}/enrich`

- Looks up the site's lat/lon
- Runs all registered adapters (NASA POWER, PeeringDB) concurrently
- For each adapter result: upserts a SiteScore row (update if category already exists for this site, insert if not)
- Returns the updated composite score response (same shape as `GET /api/sites/{site_id}/scores`)

Response: same as `CompositeResponse` — `{ site_id, composite, scores }` plus the `data_json` for each category.

### Enrichment response shape

The current `GET /api/sites/{site_id}/scores` returns `{ site_id, composite, scores: { category: raw_score } }`. To support breakdowns, extend it to also return the data_json per category:

```json
{
  "site_id": "uuid",
  "composite": 84.5,
  "scores": {
    "connectivity": 85,
    "environmental": 84
  },
  "details": {
    "connectivity": {
      "raw_score": 85,
      "data_json": { "ixp_count_100km": 3, "nearest_ixp_km": 12.5 },
      "source": "peeringdb"
    },
    "environmental": {
      "raw_score": 84,
      "data_json": { "avg_temp_c": 19.63, ... },
      "source": "nasa_power"
    }
  }
}
```

This is a backwards-compatible addition to the existing endpoint — `scores` stays the same, `details` is new.

### Upsert logic

When enrichment runs and a SiteScore already exists for (site_id, category), update it rather than creating a duplicate. Use SQL `ON CONFLICT` or a select-then-update pattern.

### Frontend UX

1. "Fetch Scores" button appears below the composite score in the detail panel
2. On click:
   - Button text changes to "Fetching..." and is disabled
   - A spinner icon appears next to the text
   - Existing score bars show a pulsing animation (CSS opacity pulse)
3. On completion:
   - Scores refresh in the panel (new values, breakdowns available)
   - Pin color on the map updates if composite changed
   - Button returns to normal state
4. On error:
   - Button returns to normal
   - Error message appears below the button: "Failed to fetch scores"

## Component Changes

### Backend

| File | Change |
|------|--------|
| `backend/app/routers/scores.py` | Add `POST /enrich` endpoint; extend `GET` response with `details` field |
| `backend/app/schemas/score.py` | Add `ScoreDetail` and `EnrichedCompositeResponse` schemas |
| `backend/app/services/scoring.py` | Add `enrich_site()` function that runs adapters and upserts scores |
| `backend/tests/test_scoring.py` | Add enrichment endpoint tests |

### Frontend

| File | Change |
|------|--------|
| `src/types/site.ts` | Add `ScoreDetail`, `EnrichedCompositeScore` types; add score metadata config |
| `src/services/api.ts` | Add `enrichSite()` function |
| `src/components/SitePanel/ScoreBar.tsx` | Make expandable (click to toggle breakdown) |
| `src/components/SitePanel/ScoreBreakdown.tsx` | NEW: metrics table with values, sub-scores, weights, explanations |
| `src/components/SitePanel/SiteDetail.tsx` | Add "Fetch Scores" button with loading state; pass details to ScoreBar |
| `src/components/SitePanel/SitePanel.css` | Add breakdown styles, loading pulse animation |
| `src/components/SitePanel/SitePanel.test.tsx` | Add breakdown and enrichment tests |

## Testing Strategy

**Backend:**
- Enrich endpoint calls adapters and returns scores (mock adapters in test)
- Upsert logic: enriching twice updates existing scores, doesn't duplicate
- Enrich returns 404 for nonexistent site

**Frontend:**
- Score bar expands on click, shows breakdown metrics
- Score bar collapses on second click
- Only one breakdown open at a time
- "Fetch Scores" button triggers API call
- Loading state shown during fetch
- Scores update after enrichment completes
- Error state shown on failure

## Deferred

- Infrastructure adapter + map overlay (separate spec)
- Per-category refresh buttons
- Score weight configuration from UI
- Scheduled/automatic enrichment
- Score history / staleness tracking
