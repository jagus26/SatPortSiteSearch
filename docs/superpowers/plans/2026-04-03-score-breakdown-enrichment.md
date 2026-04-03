# Score Breakdown & Enrichment Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expandable score breakdowns showing metric details with explanations, and a "Fetch Scores" button that triggers adapter enrichment from the site detail panel.

**Architecture:** Backend gets a new `/enrich` endpoint that runs all adapters concurrently and upserts scores. The existing `/scores` GET endpoint is extended to return `details` (data_json + source per category). Frontend adds a score metadata config with sub-score formulas and explanations, expandable ScoreBar with ScoreBreakdown, and enrichment trigger with loading states.

**Tech Stack:** Backend: FastAPI, SQLModel, asyncpg, httpx. Frontend: React 18, TypeScript, Vitest.

---

## File Structure

```
backend/
├── app/
│   ├── routers/scores.py              # MODIFY: add /enrich endpoint, extend GET response
│   ├── schemas/score.py               # MODIFY: add ScoreDetail, EnrichedCompositeResponse
│   └── services/scoring.py            # MODIFY: add enrich_site(), extend compute_composite
├── tests/
│   └── test_scoring.py                # MODIFY: add enrichment + details tests

src/
├── types/
│   └── site.ts                        # MODIFY: add ScoreDetail, EnrichedCompositeScore
├── config/
│   └── scoreMetadata.ts               # NEW: metric definitions, sub-score formulas, explanations
├── services/
│   ├── api.ts                         # MODIFY: add enrichSite(), update fetchSiteScores return type
│   └── api.test.ts                    # MODIFY: add enrichSite test
├── components/
│   └── SitePanel/
│       ├── ScoreBar.tsx               # MODIFY: make expandable, accept details prop
│       ├── ScoreBreakdown.tsx          # NEW: metrics table with sub-scores and explanations
│       ├── SiteDetail.tsx             # MODIFY: add Fetch Scores button, pass details to ScoreBar
│       ├── SitePanel.tsx              # MODIFY: add enrichment handler, pass onEnrich to SiteDetail
│       ├── SitePanel.css              # MODIFY: add breakdown styles, loading pulse
│       └── SitePanel.test.tsx         # MODIFY: add breakdown + enrichment tests
└── App.tsx                            # MODIFY: add onEnrichSite callback, update siteScores after enrich
```

---

### Task 1: Backend — extend scores response with details

**Files:**
- Modify: `backend/app/schemas/score.py`
- Modify: `backend/app/services/scoring.py`
- Modify: `backend/app/routers/scores.py`
- Modify: `backend/tests/test_scoring.py`

- [ ] **Step 1: Write failing test for details in scores response**

Add to `backend/tests/test_scoring.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:\SatportProjects\SiteSearch\backend
conda activate sitesearch
pytest tests/test_scoring.py::test_scores_include_details -v
```

Expected: FAIL — `details` not in response

- [ ] **Step 3: Update schemas**

Replace the entire contents of `backend/app/schemas/score.py`:

```python
import uuid
from typing import Any, Optional

from pydantic import BaseModel

from app.models.score import ScoreCategory


class ScoreCreate(BaseModel):
    category: ScoreCategory
    raw_score: int
    data_json: dict[str, Any] = {}
    source: Optional[str] = None


class ScoreRead(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    category: ScoreCategory
    raw_score: int
    data_json: dict[str, Any]
    source: Optional[str]


class ScoreDetail(BaseModel):
    raw_score: int
    data_json: dict[str, Any]
    source: Optional[str]


class CompositeResponse(BaseModel):
    site_id: uuid.UUID
    composite: Optional[float]
    scores: dict[str, int]
    details: dict[str, ScoreDetail] = {}
```

- [ ] **Step 4: Update compute_composite to return details**

Replace the entire contents of `backend/app/services/scoring.py`:

```python
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.score import SiteScore


async def compute_composite(
    session: AsyncSession,
    site_id: uuid.UUID,
    weights: dict[str, float],
) -> dict[str, Any]:
    result = await session.execute(
        select(SiteScore).where(SiteScore.site_id == site_id)
    )
    site_scores = result.scalars().all()

    if not site_scores:
        return {"composite": None, "scores": {}, "details": {}}

    scores_by_category = {s.category.value: s.raw_score for s in site_scores}
    details_by_category = {
        s.category.value: {
            "raw_score": s.raw_score,
            "data_json": s.data_json,
            "source": s.source,
        }
        for s in site_scores
    }

    weighted_sum = 0.0
    weight_total = 0.0
    for category, weight in weights.items():
        if category in scores_by_category:
            weighted_sum += scores_by_category[category] * weight
            weight_total += weight

    composite = weighted_sum / weight_total if weight_total > 0 else None

    return {
        "composite": round(composite, 2) if composite is not None else None,
        "scores": scores_by_category,
        "details": details_by_category,
    }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_scoring.py -v
```

Expected: PASS (6 tests — 5 existing + 1 new)

- [ ] **Step 6: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/app/schemas/score.py backend/app/services/scoring.py backend/tests/test_scoring.py
git commit -m "feat: extend scores response with per-category details (data_json + source)"
```

---

### Task 2: Backend — enrichment endpoint

**Files:**
- Modify: `backend/app/services/scoring.py`
- Modify: `backend/app/routers/scores.py`
- Modify: `backend/tests/test_scoring.py`

- [ ] **Step 1: Write failing tests for enrich endpoint**

Add to `backend/tests/test_scoring.py`:

```python
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

    call_count = {"n": 0}
    async def mock_get(self, url, **kwargs):
        call_count["n"] += 1
        if "power.larc.nasa.gov" in str(url):
            return httpx.Response(200, json=nasa_response, request=httpx.Request("GET", url))
        else:
            return httpx.Response(200, json=peeringdb_response, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    response = await client.post(f"/api/sites/{site_id}/enrich")
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

    response = await client.post(f"/api/sites/{site_id}/enrich")
    assert response.status_code == 200
    data = response.json()
    # Environmental score should be updated (not 50 anymore)
    assert data["details"]["environmental"]["source"] == "nasa_power"
    assert data["details"]["environmental"]["raw_score"] != 50


async def test_enrich_nonexistent_site(client):
    import uuid
    fake_id = uuid.uuid4()
    response = await client.post(f"/api/sites/{fake_id}/enrich")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_scoring.py::test_enrich_site -v
```

Expected: FAIL — 404 (no route)

- [ ] **Step 3: Add enrich_site service function**

Add to the bottom of `backend/app/services/scoring.py`:

```python
import asyncio
from app.models.site import Site
from app.adapters.nasa_power import NasaPowerAdapter
from app.adapters.peeringdb import PeeringDbAdapter


ADAPTERS = [NasaPowerAdapter(), PeeringDbAdapter()]


async def enrich_site(
    session: AsyncSession,
    site_id: uuid.UUID,
    weights: dict[str, float],
) -> dict[str, Any]:
    site = await session.get(Site, site_id)
    if not site:
        return None

    # Run all adapters concurrently
    results = await asyncio.gather(
        *[adapter.fetch(latitude=site.latitude, longitude=site.longitude) for adapter in ADAPTERS],
        return_exceptions=True,
    )

    for adapter, result in zip(ADAPTERS, results):
        if isinstance(result, Exception):
            continue

        # Upsert: find existing score for this site+category, update or create
        existing = await session.execute(
            select(SiteScore).where(
                SiteScore.site_id == site_id,
                SiteScore.category == adapter.category,
            )
        )
        existing_score = existing.scalars().first()

        if existing_score:
            existing_score.raw_score = result.raw_score
            existing_score.data_json = result.data_json
            existing_score.source = result.source
            session.add(existing_score)
        else:
            new_score = SiteScore(
                site_id=site_id,
                category=adapter.category,
                raw_score=result.raw_score,
                data_json=result.data_json,
                source=result.source,
            )
            session.add(new_score)

    await session.commit()

    return await compute_composite(session, site_id, weights)
```

- [ ] **Step 4: Add enrich endpoint to router**

Add to the bottom of `backend/app/routers/scores.py`:

```python
from app.services.scoring import enrich_site


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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_scoring.py -v
```

Expected: PASS (9 tests — 6 existing + 3 new)

- [ ] **Step 6: Run all backend tests**

```bash
pytest -v
```

Expected: PASS (all 35+ tests)

- [ ] **Step 7: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add site enrichment endpoint that runs all adapters and upserts scores"
```

---

### Task 3: Frontend — score metadata config and types

**Files:**
- Modify: `src/types/site.ts`
- Create: `src/config/scoreMetadata.ts`

- [ ] **Step 1: Update site types**

Replace the entire contents of `src/types/site.ts`:

```typescript
export interface Site {
  id: string
  name: string
  slug: string
  latitude: number
  longitude: number
  status: 'candidate' | 'under-review' | 'approved' | 'rejected'
  region: string | null
  country: string | null
  country_code: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SiteCreate {
  name: string
  slug: string
  latitude: number
  longitude: number
  region?: string
  country?: string
  country_code?: string
  notes?: string
}

export interface ScoreDetail {
  raw_score: number
  data_json: Record<string, number | string | null>
  source: string | null
}

export interface CompositeScore {
  site_id: string
  composite: number | null
  scores: Record<string, number>
  details: Record<string, ScoreDetail>
}
```

- [ ] **Step 2: Create score metadata config**

Create `src/config/scoreMetadata.ts`:

```typescript
export interface MetricDef {
  key: string
  label: string
  unit: string
  weight: number
  explanation: string
  computeSubScore: (value: number) => number
}

export interface CategoryMetadata {
  metrics: MetricDef[]
}

export const SCORE_METADATA: Record<string, CategoryMetadata> = {
  environmental: {
    metrics: [
      {
        key: 'avg_temp_c',
        label: 'Temperature',
        unit: '°C',
        weight: 0.30,
        explanation: 'Ideal range for outdoor equipment',
        computeSubScore: (v) => Math.max(0, 100 - Math.abs(v - 20) * 3.3),
      },
      {
        key: 'avg_precipitation_mm',
        label: 'Precipitation',
        unit: 'mm/day',
        weight: 0.30,
        explanation: 'Lower is better for RF and operations',
        computeSubScore: (v) => Math.max(0, 100 - v * 10),
      },
      {
        key: 'avg_solar_kwh_m2',
        label: 'Solar',
        unit: 'kWh/m²/day',
        weight: 0.20,
        explanation: 'Higher means off-grid power viable',
        computeSubScore: (v) => Math.min(100, (v * 100) / 6),
      },
      {
        key: 'avg_wind_speed_ms',
        label: 'Wind',
        unit: 'm/s',
        weight: 0.20,
        explanation: 'Moderate wind, good for dish stability',
        computeSubScore: (v) => (v <= 5 ? 100 : Math.max(0, 100 - (v - 5) * 6.67)),
      },
    ],
  },
  connectivity: {
    metrics: [
      {
        key: 'ixp_count_100km',
        label: 'IXPs within 100km',
        unit: '',
        weight: 0.50,
        explanation: 'More exchange points means better connectivity options',
        computeSubScore: (v) => Math.min(100, v * 20),
      },
      {
        key: 'nearest_ixp_km',
        label: 'Nearest IXP',
        unit: 'km',
        weight: 0.50,
        explanation: 'Closer IXPs mean lower latency and easier peering',
        computeSubScore: (v) => Math.max(0, 100 - v * 0.2),
      },
    ],
  },
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add src/types/site.ts src/config/scoreMetadata.ts
git commit -m "feat: add score metadata config with sub-score formulas and explanations"
```

---

### Task 4: Frontend — API enrichment function

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/services/api.test.ts`

- [ ] **Step 1: Write failing test for enrichSite**

Add to `src/services/api.test.ts`:

```typescript
import { fetchSites, fetchSiteScores, createSite, enrichSite } from './api'
```

Update the existing import line, then add at the bottom of the file:

```typescript
describe('enrichSite', () => {
  it('sends POST request and returns enriched scores', async () => {
    const mockEnriched = {
      site_id: '123e4567-e89b-12d3-a456-426614174000',
      composite: 84.5,
      scores: { connectivity: 85, environmental: 84 },
      details: {
        connectivity: { raw_score: 85, data_json: { ixp_count_100km: 3 }, source: 'peeringdb' },
        environmental: { raw_score: 84, data_json: { avg_temp_c: 19.63 }, source: 'nasa_power' },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockEnriched,
    } as Response)

    const result = await enrichSite('123e4567-e89b-12d3-a456-426614174000')
    expect(result).toEqual(mockEnriched)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/sites/123e4567-e89b-12d3-a456-426614174000/scores/enrich',
      { method: 'POST' }
    )
  })

  it('throws on error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    await expect(enrichSite('fake-id')).rejects.toThrow('Failed to enrich site')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/api.test.ts
```

Expected: FAIL — `enrichSite` is not exported

- [ ] **Step 3: Update api.ts — add enrichSite and update fetchSiteScores**

Replace the entire contents of `src/services/api.ts`:

```typescript
import type { Site, SiteCreate, CompositeScore } from '../types/site'

const API_BASE = 'http://localhost:8000'

export async function fetchSites(): Promise<Site[]> {
  try {
    const response = await fetch(`${API_BASE}/api/sites`)
    if (!response.ok) return []
    return await response.json()
  } catch {
    return []
  }
}

export async function fetchSiteScores(siteId: string): Promise<CompositeScore> {
  try {
    const response = await fetch(`${API_BASE}/api/sites/${siteId}/scores`)
    if (!response.ok) return { site_id: siteId, composite: null, scores: {}, details: {} }
    return await response.json()
  } catch {
    return { site_id: siteId, composite: null, scores: {}, details: {} }
  }
}

export async function createSite(data: SiteCreate): Promise<Site> {
  const response = await fetch(`${API_BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create site')
  }
  return await response.json()
}

export async function enrichSite(siteId: string): Promise<CompositeScore> {
  const response = await fetch(`${API_BASE}/api/sites/${siteId}/scores/enrich`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error('Failed to enrich site')
  }
  return await response.json()
}
```

- [ ] **Step 4: Update existing fetchSiteScores test for new return shape**

In `src/services/api.test.ts`, update the `mockScores` constant at the top:

```typescript
const mockScores: CompositeScore = {
  site_id: '123e4567-e89b-12d3-a456-426614174000',
  composite: 82.5,
  scores: { connectivity: 90, environmental: 75 },
  details: {
    connectivity: { raw_score: 90, data_json: { ixp_count_100km: 3 }, source: 'peeringdb' },
    environmental: { raw_score: 75, data_json: { avg_temp_c: 22.0 }, source: 'nasa_power' },
  },
}
```

And update the error fallback test for `fetchSiteScores`:

```typescript
  it('returns null composite on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const scores = await fetchSiteScores('fake-id')
    expect(scores).toEqual({ site_id: 'fake-id', composite: null, scores: {}, details: {} })
  })
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/services/api.test.ts
```

Expected: PASS (8 tests — 6 existing + 2 new)

- [ ] **Step 6: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add src/services/api.ts src/services/api.test.ts
git commit -m "feat: add enrichSite API function and update fetchSiteScores for details"
```

---

### Task 5: Frontend — ScoreBreakdown component and expandable ScoreBar

**Files:**
- Create: `src/components/SitePanel/ScoreBreakdown.tsx`
- Modify: `src/components/SitePanel/ScoreBar.tsx`
- Modify: `src/components/SitePanel/SitePanel.css`
- Modify: `src/components/SitePanel/SitePanel.test.tsx`

- [ ] **Step 1: Write failing tests for breakdown**

Add to the top of `src/components/SitePanel/SitePanel.test.tsx` (alongside existing imports):

```typescript
import { ScoreBreakdown } from './ScoreBreakdown'
```

Add these test blocks:

```typescript
describe('ScoreBreakdown', () => {
  it('renders metric rows with values and sub-scores', () => {
    const dataJson = { avg_temp_c: 19.63, avg_precipitation_mm: 3.7 }
    render(<ScoreBreakdown category="environmental" dataJson={dataJson} />)
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    expect(screen.getByText('19.6°C')).toBeInTheDocument()
    expect(screen.getByText('Precipitation')).toBeInTheDocument()
    expect(screen.getByText('3.7mm/day')).toBeInTheDocument()
  })

  it('renders explanations', () => {
    const dataJson = { avg_temp_c: 20.0 }
    render(<ScoreBreakdown category="environmental" dataJson={dataJson} />)
    expect(screen.getByText('Ideal range for outdoor equipment')).toBeInTheDocument()
  })

  it('renders weights as percentages', () => {
    const dataJson = { avg_temp_c: 20.0 }
    render(<ScoreBreakdown category="environmental" dataJson={dataJson} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('renders nothing for unknown category', () => {
    const { container } = render(<ScoreBreakdown category="unknown" dataJson={{}} />)
    expect(container.querySelector('.score-breakdown')).toBeNull()
  })
})

describe('ScoreBar expandable', () => {
  it('expands breakdown on click when details provided', async () => {
    const user = userEvent.setup()
    const detail = { raw_score: 84, data_json: { avg_temp_c: 19.63 }, source: 'nasa_power' }
    render(<ScoreBar label="Environmental" score={84} category="environmental" detail={detail} />)

    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
    await user.click(screen.getByText('Environmental'))
    expect(screen.getByText('Temperature')).toBeInTheDocument()
  })

  it('collapses breakdown on second click', async () => {
    const user = userEvent.setup()
    const detail = { raw_score: 84, data_json: { avg_temp_c: 19.63 }, source: 'nasa_power' }
    render(<ScoreBar label="Environmental" score={84} category="environmental" detail={detail} />)

    await user.click(screen.getByText('Environmental'))
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    await user.click(screen.getByText('Environmental'))
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
  })

  it('does not expand when no detail provided', async () => {
    const user = userEvent.setup()
    render(<ScoreBar label="Environmental" score={84} />)
    await user.click(screen.getByText('Environmental'))
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SitePanel/SitePanel.test.tsx
```

Expected: FAIL — `ScoreBreakdown` not found

- [ ] **Step 3: Create ScoreBreakdown component**

Create `src/components/SitePanel/ScoreBreakdown.tsx`:

```typescript
import { SCORE_METADATA } from '../../config/scoreMetadata'

interface ScoreBreakdownProps {
  category: string
  dataJson: Record<string, number | string | null>
}

export function ScoreBreakdown({ category, dataJson }: ScoreBreakdownProps) {
  const metadata = SCORE_METADATA[category]
  if (!metadata) return null

  return (
    <div className="score-breakdown">
      {metadata.metrics.map((metric) => {
        const rawValue = dataJson[metric.key]
        if (rawValue === undefined || rawValue === null) return null
        const numValue = Number(rawValue)
        const subScore = Math.round(metric.computeSubScore(numValue))
        const displayValue = Number.isInteger(numValue) ? numValue.toString() : numValue.toFixed(1)
        const weightPct = `${Math.round(metric.weight * 100)}%`

        return (
          <div key={metric.key} className="breakdown-row">
            <div className="breakdown-main">
              <span className="breakdown-label">{metric.label}</span>
              <span className="breakdown-value">{displayValue}{metric.unit}</span>
              <span className="breakdown-subscore">{subScore}</span>
              <span className="breakdown-weight">{weightPct}</span>
            </div>
            <div className="breakdown-explanation">{metric.explanation}</div>
          </div>
        )
      })}
      <div className="breakdown-source">Source: {category}</div>
    </div>
  )
}
```

- [ ] **Step 4: Update ScoreBar to be expandable**

Replace the entire contents of `src/components/SitePanel/ScoreBar.tsx`:

```typescript
import { useState } from 'react'
import { ScoreBreakdown } from './ScoreBreakdown'
import type { ScoreDetail } from '../../types/site'

interface ScoreBarProps {
  label: string
  score: number
  category?: string
  detail?: ScoreDetail
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function ScoreBar({ label, score, category, detail }: ScoreBarProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = !!detail && !!category

  return (
    <div className={`score-bar-wrapper${expanded ? ' expanded' : ''}`}>
      <div
        className={`score-bar${canExpand ? ' expandable' : ''}`}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <span className="score-bar-label">{label}</span>
        <div className="score-bar-track">
          <div
            className="score-bar-fill"
            style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
          />
        </div>
        <span className="score-bar-value">{score}</span>
        {canExpand && <span className="score-bar-chevron">{expanded ? '▴' : '▾'}</span>}
      </div>
      {expanded && detail && category && (
        <ScoreBreakdown category={category} dataJson={detail.data_json} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add breakdown and expandable styles to SitePanel.css**

Add to the bottom of `src/components/SitePanel/SitePanel.css`:

```css
/* Expandable score bar */
.score-bar-wrapper {
  border-radius: 6px;
}

.score-bar-wrapper.expanded {
  background: #0f172a;
  padding-bottom: 8px;
}

.score-bar.expandable {
  cursor: pointer;
}

.score-bar.expandable:hover .score-bar-label {
  color: #f1f5f9;
}

.score-bar-chevron {
  font-size: 10px;
  color: #64748b;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

/* Score breakdown */
.score-breakdown {
  padding: 8px 12px 4px;
}

.breakdown-row {
  margin-bottom: 8px;
}

.breakdown-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.breakdown-label {
  color: #94a3b8;
  width: 90px;
  flex-shrink: 0;
}

.breakdown-value {
  color: #e2e8f0;
  width: 70px;
  flex-shrink: 0;
}

.breakdown-subscore {
  color: #f1f5f9;
  font-weight: 600;
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

.breakdown-weight {
  color: #64748b;
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.breakdown-explanation {
  font-size: 10px;
  color: #64748b;
  font-style: italic;
  padding-left: 90px;
  margin-top: 2px;
}

.breakdown-source {
  font-size: 10px;
  color: #475569;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #1e293b;
}

/* Loading pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.score-bar-wrapper.loading .score-bar-fill {
  animation: pulse 1.5s ease-in-out infinite;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/components/SitePanel/SitePanel.test.tsx
```

Expected: PASS (all existing + 7 new tests)

- [ ] **Step 7: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add src/components/SitePanel/ src/config/
git commit -m "feat: add expandable score bars with metric breakdown and explanations"
```

---

### Task 6: Frontend — Fetch Scores button and wiring

**Files:**
- Modify: `src/components/SitePanel/SiteDetail.tsx`
- Modify: `src/components/SitePanel/SitePanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/SitePanel/SitePanel.test.tsx`

- [ ] **Step 1: Write failing tests for Fetch Scores button**

Add to `src/components/SitePanel/SitePanel.test.tsx`:

```typescript
describe('SiteDetail enrichment', () => {
  it('renders Fetch Scores button', () => {
    render(
      <SiteDetail
        site={mockSite}
        scores={mockScores}
        onClose={() => {}}
        onEnrich={() => Promise.resolve()}
        isEnriching={false}
      />
    )
    expect(screen.getByText('Fetch Scores')).toBeInTheDocument()
  })

  it('calls onEnrich when Fetch Scores is clicked', async () => {
    const user = userEvent.setup()
    const onEnrich = vi.fn().mockResolvedValue(undefined)
    render(
      <SiteDetail
        site={mockSite}
        scores={mockScores}
        onClose={() => {}}
        onEnrich={onEnrich}
        isEnriching={false}
      />
    )
    await user.click(screen.getByText('Fetch Scores'))
    expect(onEnrich).toHaveBeenCalledOnce()
  })

  it('shows Fetching... when enriching', () => {
    render(
      <SiteDetail
        site={mockSite}
        scores={mockScores}
        onClose={() => {}}
        onEnrich={() => Promise.resolve()}
        isEnriching={true}
      />
    )
    expect(screen.getByText('Fetching...')).toBeInTheDocument()
    expect(screen.getByText('Fetching...').closest('button')).toBeDisabled()
  })
})
```

Also update the existing SiteDetail tests to include the new required props. Find all `render(<SiteDetail` calls in the existing tests and add `onEnrich={() => Promise.resolve()} isEnriching={false}`:

For example, the existing test:
```typescript
render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} />)
```
becomes:
```typescript
render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} onEnrich={() => Promise.resolve()} isEnriching={false} />)
```

Update the `mockScores` at the top of the file to include `details`:

```typescript
const mockScores: CompositeScore = {
  site_id: '123e4567-e89b-12d3-a456-426614174000',
  composite: 82.5,
  scores: { connectivity: 90, environmental: 75 },
  details: {
    connectivity: { raw_score: 90, data_json: { ixp_count_100km: 3, nearest_ixp_km: 12.5 }, source: 'peeringdb' },
    environmental: { raw_score: 75, data_json: { avg_temp_c: 22.0, avg_precipitation_mm: 2.0, avg_solar_kwh_m2: 5.0, avg_wind_speed_ms: 3.0 }, source: 'nasa_power' },
  },
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SitePanel/SitePanel.test.tsx
```

Expected: FAIL — `onEnrich` prop not accepted

- [ ] **Step 3: Update SiteDetail with Fetch Scores button and detail passing**

Replace the entire contents of `src/components/SitePanel/SiteDetail.tsx`:

```typescript
import type { Site, CompositeScore } from '../../types/site'
import { ScoreBar } from './ScoreBar'

interface SiteDetailProps {
  site: Site
  scores: CompositeScore
  onClose: () => void
  onEnrich: () => Promise<void>
  isEnriching: boolean
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

const CATEGORY_LABELS: Record<string, string> = {
  connectivity: 'Connectivity',
  environmental: 'Environmental',
  infrastructure: 'Infrastructure',
  regulatory: 'Regulatory',
  rf_satellite: 'RF / Satellite',
  geopolitical: 'Geopolitical',
}

export function SiteDetail({ site, scores, onClose, onEnrich, isEnriching }: SiteDetailProps) {
  const composite = scores.composite !== null ? Math.round(scores.composite) : null

  return (
    <div className="site-detail">
      <div className="panel-header">
        <h2 className="panel-title">{site.name}</h2>
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          &times;
        </button>
      </div>

      <div className="panel-badges">
        <span className={`badge badge-status badge-${site.status}`}>{site.status}</span>
        {site.country && <span className="badge badge-country">{site.country}</span>}
      </div>

      {composite !== null ? (
        <div className="composite-score">
          <span className="composite-value" style={{ color: scoreColor(composite) }}>
            {composite}
          </span>
          <span className="composite-label">composite score</span>
        </div>
      ) : (
        <div className="composite-score">
          <span className="composite-value" style={{ color: '#64748b' }}>–</span>
          <span className="composite-label">No scores yet</span>
        </div>
      )}

      <div className="enrich-section">
        <button
          className={`enrich-btn${isEnriching ? ' loading' : ''}`}
          onClick={onEnrich}
          disabled={isEnriching}
        >
          {isEnriching ? 'Fetching...' : 'Fetch Scores'}
        </button>
      </div>

      <div className={`score-bars${isEnriching ? ' enriching' : ''}`}>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const value = scores.scores[key]
          const detail = scores.details?.[key]
          return value !== undefined ? (
            <ScoreBar key={key} label={label} score={value} category={key} detail={detail} />
          ) : null
        })}
      </div>

      <div className="panel-footer">
        {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
        {site.region && <> &middot; {site.region}</>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update SitePanel to handle enrichment**

Replace the entire contents of `src/components/SitePanel/SitePanel.tsx`:

```typescript
import { useEffect, useState } from 'react'
import type { Site, SiteCreate, CompositeScore } from '../../types/site'
import type { LatLon } from '../../types/map'
import { fetchSiteScores, enrichSite } from '../../services/api'
import { SiteDetail } from './SiteDetail'
import { SiteForm } from './SiteForm'
import './SitePanel.css'

interface SitePanelProps {
  mode: 'view' | 'create'
  site?: Site | null
  createCoords?: LatLon | null
  onClose: () => void
  onCreateSite: (data: SiteCreate) => Promise<void>
  onScoresUpdated?: (siteId: string, composite: number | null) => void
}

export function SitePanel({ mode, site, createCoords, onClose, onCreateSite, onScoresUpdated }: SitePanelProps) {
  const [scores, setScores] = useState<CompositeScore | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)

  useEffect(() => {
    if (mode === 'view' && site) {
      fetchSiteScores(site.id).then(setScores)
    }
  }, [mode, site])

  const handleEnrich = async () => {
    if (!site) return
    setIsEnriching(true)
    try {
      const result = await enrichSite(site.id)
      setScores(result)
      if (onScoresUpdated) {
        onScoresUpdated(site.id, result.composite)
      }
    } catch {
      // Scores stay as they were
    } finally {
      setIsEnriching(false)
    }
  }

  const handleCreate = async (data: SiteCreate) => {
    try {
      setCreateError(null)
      await onCreateSite(data)
    } catch {
      setCreateError('Failed to create site. Please try again.')
    }
  }

  return (
    <div className="site-panel">
      {mode === 'view' && site && scores && (
        <SiteDetail
          site={site}
          scores={scores}
          onClose={onClose}
          onEnrich={handleEnrich}
          isEnriching={isEnriching}
        />
      )}
      {mode === 'create' && (
        <SiteForm
          onSubmit={handleCreate}
          onClose={onClose}
          initialCoords={createCoords}
          error={createError}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add enrich button styles to SitePanel.css**

Add to `src/components/SitePanel/SitePanel.css` (before the breakdown styles):

```css
/* Enrich button */
.enrich-section {
  padding: 0 20px 16px;
}

.enrich-btn {
  width: 100%;
  padding: 10px;
  background: #334155;
  color: #f1f5f9;
  border: 1px solid #475569;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.enrich-btn:hover:not(:disabled) {
  background: #475569;
}

.enrich-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.enrich-btn.loading {
  animation: pulse 1.5s ease-in-out infinite;
}

.score-bars.enriching .score-bar-fill {
  animation: pulse 1.5s ease-in-out infinite;
}
```

- [ ] **Step 6: Update App.tsx to pass onScoresUpdated**

In `src/App.tsx`, update the `SitePanel` JSX to include the new prop:

Replace:
```typescript
      {panelMode && (
        <SitePanel
          mode={panelMode}
          site={selectedSite}
          createCoords={createCoords}
          onClose={handleClosePanel}
          onCreateSite={handleCreateSite}
        />
      )}
```

With:
```typescript
      {panelMode && (
        <SitePanel
          mode={panelMode}
          site={selectedSite}
          createCoords={createCoords}
          onClose={handleClosePanel}
          onCreateSite={handleCreateSite}
          onScoresUpdated={(siteId, composite) => {
            if (composite !== null) {
              setSiteScores((prev) => ({ ...prev, [siteId]: composite }))
            }
          }}
        />
      )}
```

- [ ] **Step 7: Run all frontend tests**

```bash
npx vitest run
```

Expected: PASS — all tests

- [ ] **Step 8: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add src/
git commit -m "feat: add Fetch Scores button with loading state and score update propagation"
```

---

### Task 7: Smoke test

- [ ] **Step 1: Start the backend**

```bash
cd C:\SatportProjects\SiteSearch\backend
conda activate sitesearch
uvicorn app.main:app --reload
```

Verify: http://localhost:8000/health returns `{"status":"ok"}`

- [ ] **Step 2: Start the frontend**

```bash
cd C:\SatportProjects\SiteSearch
npm run dev
```

Open http://localhost:5173

- [ ] **Step 3: Click a site pin to open the detail panel**

If you have the Sao Paulo site from earlier, click it. You should see the detail panel with score bars.

- [ ] **Step 4: Click "Fetch Scores"**

The button should change to "Fetching..." and disable. Score bars should pulse. After a few seconds (NASA POWER API call), scores should update with real values. The pin color on the map should update if the composite changed. Copy the site ID from the browser's network tab or from the URL — you'll need it to verify in step 6.

- [ ] **Step 5: Click a score bar to expand the breakdown**

Click the Environmental bar. It should expand showing:
- Temperature with value, sub-score, weight (30%), and explanation
- Precipitation with value, sub-score, weight (30%), and explanation
- Solar with value, sub-score, weight (20%), and explanation
- Wind with value, sub-score, weight (20%), and explanation

Click again to collapse.

- [ ] **Step 6: Verify enrichment persisted**

Refresh the page. Click the same site pin. The scores should still be there (they were saved to the database by the enrich endpoint, not just displayed temporarily).

- [ ] **Step 7: Run all tests (frontend + backend)**

```bash
cd C:\SatportProjects\SiteSearch
npx vitest run
cd backend
conda activate sitesearch
pytest -v
```

Expected: All tests pass

- [ ] **Step 8: Final commit**

```bash
cd C:\SatportProjects\SiteSearch
git add -A
git commit -m "feat: complete score breakdown and enrichment trigger"
```

---

## Summary

After completing all 7 tasks:

| Component | What it does |
|-----------|-------------|
| Extended scores API | Returns `details` with `data_json` and `source` per category |
| Enrich endpoint | `POST /enrich` runs all adapters, upserts scores |
| Score metadata config | Sub-score formulas, weights, and explanations per metric |
| Expandable ScoreBar | Click to toggle metric breakdown |
| ScoreBreakdown | Metrics table with value, sub-score, weight, explanation |
| Fetch Scores button | Triggers enrichment, shows loading state, updates map pin |
