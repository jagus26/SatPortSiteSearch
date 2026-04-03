# Frontend-API Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the React frontend to the FastAPI backend — show sites as score-pin markers on the map, view site details with scores in a right side panel, and create new sites via click-on-map or toolbar button.

**Architecture:** App component manages `sites[]`, `selectedSiteId`, and `panelMode` state. New `api.ts` service talks to FastAPI endpoints. MapView renders `Marker` components for each site. SitePanel slides in from the right for view/create modes. Dark theme applied to all UI chrome.

**Tech Stack:** React 18, TypeScript, react-map-gl v8 (Marker component), MapLibre GL JS, Vite, Vitest

---

## File Structure

```
src/
├── types/
│   ├── map.ts                          # (existing) ViewState, SearchResult, LatLon
│   └── site.ts                         # NEW: Site, SiteCreate, CompositeScore
├── services/
│   ├── geocoding.ts                    # (existing, unchanged)
│   ├── api.ts                          # NEW: fetchSites, fetchSiteScores, createSite
│   └── api.test.ts                     # NEW: API service tests
├── components/
│   ├── SearchBar/
│   │   ├── SearchBar.tsx               # MODIFY: dark theme CSS
│   │   └── SearchBar.css               # MODIFY: dark theme colors
│   ├── MapView/
│   │   ├── MapView.tsx                 # MODIFY: add sites prop, Marker rendering, click handlers
│   │   ├── MapView.css                 # MODIFY: marker styles
│   │   └── MapView.test.tsx            # MODIFY: marker and click tests
│   ├── SitePanel/
│   │   ├── SitePanel.tsx               # NEW: panel container (view/create modes)
│   │   ├── SitePanel.css               # NEW: panel styles
│   │   ├── SiteDetail.tsx              # NEW: view mode (name, scores, info)
│   │   ├── SiteForm.tsx                # NEW: create mode (form)
│   │   ├── ScoreBar.tsx                # NEW: single score bar component
│   │   └── SitePanel.test.tsx          # NEW: panel tests
│   └── Toolbar/
│       ├── Toolbar.tsx                 # NEW: top-right bar with Add Site button
│       ├── Toolbar.css                 # NEW: toolbar styles
│       └── Toolbar.test.tsx            # NEW: toolbar tests
├── __mocks__/
│   └── react-map-gl/
│       └── maplibre.tsx                # MODIFY: add Marker mock
├── App.tsx                             # MODIFY: sites state, API calls, panel logic
├── App.css                             # MODIFY: dark theme base
└── App.test.tsx                        # MODIFY: integration tests
```

---

### Task 1: Site types and API service

**Files:**
- Create: `src/types/site.ts`
- Create: `src/services/api.ts`
- Create: `src/services/api.test.ts`

- [ ] **Step 1: Create site types**

Create `src/types/site.ts`:

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

export interface CompositeScore {
  site_id: string
  composite: number | null
  scores: Record<string, number>
}
```

- [ ] **Step 2: Write failing tests for API service**

Create `src/services/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSites, fetchSiteScores, createSite } from './api'
import type { Site, CompositeScore } from '../types/site'

const mockSite: Site = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Sao Paulo Station',
  slug: 'sao-paulo-station',
  latitude: -23.5505,
  longitude: -46.6333,
  status: 'candidate',
  region: 'South America',
  country: 'Brazil',
  country_code: 'BR',
  notes: null,
  created_at: '2026-04-02T12:00:00Z',
  updated_at: '2026-04-02T12:00:00Z',
}

const mockScores: CompositeScore = {
  site_id: '123e4567-e89b-12d3-a456-426614174000',
  composite: 82.5,
  scores: { connectivity: 90, environmental: 75 },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchSites', () => {
  it('fetches all sites from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockSite],
    } as Response)

    const sites = await fetchSites()
    expect(sites).toEqual([mockSite])
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/sites')
  })

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const sites = await fetchSites()
    expect(sites).toEqual([])
  })
})

describe('fetchSiteScores', () => {
  it('fetches composite scores for a site', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockScores,
    } as Response)

    const scores = await fetchSiteScores('123e4567-e89b-12d3-a456-426614174000')
    expect(scores).toEqual(mockScores)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/sites/123e4567-e89b-12d3-a456-426614174000/scores'
    )
  })

  it('returns null composite on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const scores = await fetchSiteScores('fake-id')
    expect(scores).toEqual({ site_id: 'fake-id', composite: null, scores: {} })
  })
})

describe('createSite', () => {
  it('sends POST request and returns created site', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSite,
    } as Response)

    const newSite = {
      name: 'Sao Paulo Station',
      slug: 'sao-paulo-station',
      latitude: -23.5505,
      longitude: -46.6333,
    }
    const result = await createSite(newSite)
    expect(result).toEqual(mockSite)
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSite),
    })
  })

  it('throws on error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Validation error' }),
    } as Response)

    await expect(createSite({ name: '', slug: '', latitude: 0, longitude: 0 }))
      .rejects.toThrow('Failed to create site')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd C:\SatportProjects\SiteSearch
npx vitest run src/services/api.test.ts
```

Expected: FAIL — `Cannot find module './api'`

- [ ] **Step 4: Create API service**

Create `src/services/api.ts`:

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
    if (!response.ok) return { site_id: siteId, composite: null, scores: {} }
    return await response.json()
  } catch {
    return { site_id: siteId, composite: null, scores: {} }
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/services/api.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/site.ts src/services/api.ts src/services/api.test.ts
git commit -m "feat: add site types and API service for sites CRUD and scores"
```

---

### Task 2: Dark theme for SearchBar and App shell

**Files:**
- Modify: `src/components/SearchBar/SearchBar.css`
- Modify: `src/App.css`
- Modify: `src/index.css` (if exists, for global font)

- [ ] **Step 1: Update SearchBar CSS to dark theme**

Replace the contents of `src/components/SearchBar/SearchBar.css`:

```css
.search-bar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  width: 360px;
  font-family: system-ui, sans-serif;
}

.search-input-wrapper {
  position: relative;
}

.search-bar input {
  width: 100%;
  padding: 12px 36px 12px 16px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  font-size: 14px;
  color: #f1f5f9;
  outline: none;
  box-sizing: border-box;
}

.search-bar input::placeholder {
  color: #64748b;
}

.search-bar input:focus {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  border-color: #475569;
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

.search-clear:hover {
  color: #f1f5f9;
}

.search-results {
  margin-top: 4px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.search-result-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #f1f5f9;
  border-bottom: 1px solid #334155;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #334155;
}
```

- [ ] **Step 2: Verify SearchBar tests still pass**

```bash
npx vitest run src/components/SearchBar/
```

Expected: PASS (existing tests unaffected — CSS only change)

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchBar/SearchBar.css
git commit -m "style: apply dark theme to SearchBar"
```

---

### Task 3: Toolbar component

**Files:**
- Create: `src/components/Toolbar/Toolbar.tsx`
- Create: `src/components/Toolbar/Toolbar.css`
- Create: `src/components/Toolbar/Toolbar.test.tsx`

- [ ] **Step 1: Write failing test for Toolbar**

Create `src/components/Toolbar/Toolbar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('renders the Add Site button', () => {
    render(<Toolbar onAddSite={() => {}} />)
    expect(screen.getByText('+ Add Site')).toBeInTheDocument()
  })

  it('calls onAddSite when button is clicked', async () => {
    const user = userEvent.setup()
    const onAddSite = vi.fn()
    render(<Toolbar onAddSite={onAddSite} />)

    await user.click(screen.getByText('+ Add Site'))
    expect(onAddSite).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/Toolbar/Toolbar.test.tsx
```

Expected: FAIL — `Cannot find module './Toolbar'`

- [ ] **Step 3: Create Toolbar component**

Create `src/components/Toolbar/Toolbar.tsx`:

```typescript
import './Toolbar.css'

interface ToolbarProps {
  onAddSite: () => void
}

export function Toolbar({ onAddSite }: ToolbarProps) {
  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={onAddSite}>
        + Add Site
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create Toolbar styles**

Create `src/components/Toolbar/Toolbar.css`:

```css
.toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  gap: 8px;
  font-family: system-ui, sans-serif;
}

.toolbar-btn {
  padding: 10px 18px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.toolbar-btn:hover {
  background: #334155;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/Toolbar/Toolbar.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/Toolbar/
git commit -m "feat: add Toolbar component with Add Site button"
```

---

### Task 4: SitePanel with ScoreBar, SiteDetail, and SiteForm

**Files:**
- Create: `src/components/SitePanel/ScoreBar.tsx`
- Create: `src/components/SitePanel/SiteDetail.tsx`
- Create: `src/components/SitePanel/SiteForm.tsx`
- Create: `src/components/SitePanel/SitePanel.tsx`
- Create: `src/components/SitePanel/SitePanel.css`
- Create: `src/components/SitePanel/SitePanel.test.tsx`

- [ ] **Step 1: Write failing tests for SitePanel**

Create `src/components/SitePanel/SitePanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SiteDetail } from './SiteDetail'
import { SiteForm } from './SiteForm'
import { ScoreBar } from './ScoreBar'
import type { Site, CompositeScore } from '../../types/site'

const mockSite: Site = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Sao Paulo Station',
  slug: 'sao-paulo-station',
  latitude: -23.5505,
  longitude: -46.6333,
  status: 'approved',
  region: 'South America',
  country: 'Brazil',
  country_code: 'BR',
  notes: null,
  created_at: '2026-04-02T12:00:00Z',
  updated_at: '2026-04-02T12:00:00Z',
}

const mockScores: CompositeScore = {
  site_id: '123e4567-e89b-12d3-a456-426614174000',
  composite: 82.5,
  scores: { connectivity: 90, environmental: 75 },
}

describe('ScoreBar', () => {
  it('renders label and score value', () => {
    render(<ScoreBar label="Connectivity" score={90} />)
    expect(screen.getByText('Connectivity')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('renders green bar for score >= 70', () => {
    const { container } = render(<ScoreBar label="Test" score={85} />)
    const fill = container.querySelector('.score-bar-fill')
    expect(fill).toHaveStyle({ width: '85%' })
  })
})

describe('SiteDetail', () => {
  it('renders site name and status', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} />)
    expect(screen.getByText('Sao Paulo Station')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
  })

  it('renders composite score', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} />)
    expect(screen.getByText('83')).toBeInTheDocument()
  })

  it('renders category scores', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} />)
    expect(screen.getByText('Connectivity')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('Environmental')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders coordinates', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} />)
    expect(screen.getByText(/-23\.5505.*-46\.6333/)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={onClose} />)
    await user.click(screen.getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows "No scores yet" when composite is null', () => {
    const noScores: CompositeScore = { site_id: mockSite.id, composite: null, scores: {} }
    render(<SiteDetail site={mockSite} scores={noScores} onClose={() => {}} />)
    expect(screen.getByText('No scores yet')).toBeInTheDocument()
  })
})

describe('SiteForm', () => {
  it('renders form fields', () => {
    render(<SiteForm onSubmit={() => {}} onClose={() => {}} />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument()
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument()
  })

  it('pre-fills coordinates when provided', () => {
    render(
      <SiteForm
        onSubmit={() => {}}
        onClose={() => {}}
        initialCoords={{ latitude: -23.55, longitude: -46.63 }}
      />
    )
    expect(screen.getByLabelText('Latitude')).toHaveValue(-23.55)
    expect(screen.getByLabelText('Longitude')).toHaveValue(-46.63)
  })

  it('auto-generates slug from name', async () => {
    const user = userEvent.setup()
    render(<SiteForm onSubmit={() => {}} onClose={() => {}} />)
    await user.type(screen.getByLabelText('Name'), 'Sao Paulo Station')
    expect(screen.getByLabelText('Slug')).toHaveValue('sao-paulo-station')
  })

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <SiteForm
        onSubmit={onSubmit}
        onClose={() => {}}
        initialCoords={{ latitude: -23.55, longitude: -46.63 }}
      />
    )
    await user.type(screen.getByLabelText('Name'), 'Test Site')
    await user.click(screen.getByText('Create Site'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Site',
        slug: 'test-site',
        latitude: -23.55,
        longitude: -46.63,
      })
    )
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SiteForm onSubmit={() => {}} onClose={onClose} />)
    await user.click(screen.getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SitePanel/SitePanel.test.tsx
```

Expected: FAIL — `Cannot find module './SiteDetail'`

- [ ] **Step 3: Create ScoreBar component**

Create `src/components/SitePanel/ScoreBar.tsx`:

```typescript
interface ScoreBarProps {
  label: string
  score: number
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function ScoreBar({ label, score }: ScoreBarProps) {
  return (
    <div className="score-bar">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      <span className="score-bar-value">{score}</span>
    </div>
  )
}
```

- [ ] **Step 4: Create SiteDetail component**

Create `src/components/SitePanel/SiteDetail.tsx`:

```typescript
import type { Site, CompositeScore } from '../../types/site'
import { ScoreBar } from './ScoreBar'

interface SiteDetailProps {
  site: Site
  scores: CompositeScore
  onClose: () => void
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

export function SiteDetail({ site, scores, onClose }: SiteDetailProps) {
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

      <div className="score-bars">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const value = scores.scores[key]
          return value !== undefined ? (
            <ScoreBar key={key} label={label} score={value} />
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

- [ ] **Step 5: Create SiteForm component**

Create `src/components/SitePanel/SiteForm.tsx`:

```typescript
import { useState, useCallback } from 'react'
import type { SiteCreate } from '../../types/site'
import type { LatLon } from '../../types/map'

interface SiteFormProps {
  onSubmit: (data: SiteCreate) => void
  onClose: () => void
  initialCoords?: LatLon | null
  error?: string | null
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SiteForm({ onSubmit, onClose, initialCoords, error }: SiteFormProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [latitude, setLatitude] = useState(initialCoords?.latitude ?? '')
  const [longitude, setLongitude] = useState(initialCoords?.longitude ?? '')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [notes, setNotes] = useState('')

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setSlug(toSlug(value))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: SiteCreate = {
      name,
      slug,
      latitude: Number(latitude),
      longitude: Number(longitude),
    }
    if (region) data.region = region
    if (country) data.country = country
    if (countryCode) data.country_code = countryCode
    if (notes) data.notes = notes
    onSubmit(data)
  }

  return (
    <div className="site-form">
      <div className="panel-header">
        <h2 className="panel-title">Add New Site</h2>
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          &times;
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label className="form-field">
          <span className="form-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Latitude</span>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Longitude</span>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Region</span>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-label">Country</span>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-label">Country Code</span>
          <input
            type="text"
            maxLength={2}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        <button type="submit" className="form-submit">Create Site</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Create SitePanel container**

Create `src/components/SitePanel/SitePanel.tsx`:

```typescript
import { useEffect, useState } from 'react'
import type { Site, SiteCreate, CompositeScore } from '../../types/site'
import type { LatLon } from '../../types/map'
import { fetchSiteScores } from '../../services/api'
import { SiteDetail } from './SiteDetail'
import { SiteForm } from './SiteForm'
import './SitePanel.css'

interface SitePanelProps {
  mode: 'view' | 'create'
  site?: Site | null
  createCoords?: LatLon | null
  onClose: () => void
  onCreateSite: (data: SiteCreate) => Promise<void>
}

export function SitePanel({ mode, site, createCoords, onClose, onCreateSite }: SitePanelProps) {
  const [scores, setScores] = useState<CompositeScore | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'view' && site) {
      fetchSiteScores(site.id).then(setScores)
    }
  }, [mode, site])

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
        <SiteDetail site={site} scores={scores} onClose={onClose} />
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

- [ ] **Step 7: Create SitePanel styles**

Create `src/components/SitePanel/SitePanel.css`:

```css
.site-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 360px;
  height: 100%;
  background: #1e293b;
  border-left: 1px solid #334155;
  z-index: 20;
  overflow-y: auto;
  font-family: system-ui, sans-serif;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.panel-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

.panel-close:hover {
  color: #f1f5f9;
}

.panel-badges {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
}

.badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 12px;
}

.badge-status {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.badge-status.badge-approved {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.badge-status.badge-rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.badge-status.badge-under-review {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.badge-country {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.composite-score {
  text-align: center;
  padding: 20px;
}

.composite-value {
  display: block;
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
}

.composite-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}

.score-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 20px;
}

.score-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-bar-label {
  font-size: 12px;
  color: #94a3b8;
  width: 100px;
  flex-shrink: 0;
}

.score-bar-track {
  flex: 1;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.score-bar-value {
  font-size: 12px;
  color: #e2e8f0;
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

.panel-footer {
  padding: 16px 20px;
  margin-top: 16px;
  border-top: 1px solid #334155;
  font-size: 11px;
  color: #64748b;
}

/* Form styles */
.site-form form {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-field input,
.form-field textarea {
  padding: 8px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 14px;
  font-family: inherit;
  outline: none;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: #3b82f6;
}

.form-error {
  margin: 12px 20px 0;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
}

.form-submit {
  padding: 10px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}

.form-submit:hover {
  background: #2563eb;
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run src/components/SitePanel/SitePanel.test.tsx
```

Expected: PASS (11 tests)

- [ ] **Step 9: Commit**

```bash
git add src/components/SitePanel/
git commit -m "feat: add SitePanel with detail view, create form, and score bars"
```

---

### Task 5: MapView markers and click handlers

**Files:**
- Modify: `src/components/MapView/MapView.tsx`
- Modify: `src/components/MapView/MapView.css`
- Modify: `src/components/MapView/MapView.test.tsx`
- Modify: `src/__mocks__/react-map-gl/maplibre.tsx`

- [ ] **Step 1: Update the mock to export Marker**

Replace `src/__mocks__/react-map-gl/maplibre.tsx`:

```tsx
import { forwardRef } from 'react'

const Map = forwardRef(({ children, onClick, ...props }: Record<string, unknown>, ref) => (
  <div
    data-testid="map"
    ref={ref as React.Ref<HTMLDivElement>}
    onClick={(e) => {
      if (typeof onClick === 'function') {
        onClick({
          lngLat: { lng: 10.0, lat: 20.0 },
          originalEvent: e,
        })
      }
    }}
    {...props}
  >
    {children as React.ReactNode}
  </div>
))
Map.displayName = 'MockMap'

export default Map
export const NavigationControl = () => <div data-testid="navigation-control" />

export function Marker({
  children,
  longitude,
  latitude,
  onClick,
}: {
  children?: React.ReactNode
  longitude: number
  latitude: number
  onClick?: (e: { originalEvent: React.MouseEvent }) => void
}) {
  return (
    <div
      data-testid="marker"
      data-longitude={longitude}
      data-latitude={latitude}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) onClick({ originalEvent: e as unknown as React.MouseEvent })
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Write failing tests for MapView markers**

Replace `src/components/MapView/MapView.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapView } from './MapView'
import type { Site } from '../../types/site'

const mockSites: Site[] = [
  {
    id: 'site-1',
    name: 'Sao Paulo',
    slug: 'sao-paulo',
    latitude: -23.55,
    longitude: -46.63,
    status: 'approved',
    region: 'South America',
    country: 'Brazil',
    country_code: 'BR',
    notes: null,
    created_at: '2026-04-02T12:00:00Z',
    updated_at: '2026-04-02T12:00:00Z',
  },
  {
    id: 'site-2',
    name: 'Nairobi',
    slug: 'nairobi',
    latitude: -1.29,
    longitude: 36.82,
    status: 'candidate',
    region: 'East Africa',
    country: 'Kenya',
    country_code: 'KE',
    notes: null,
    created_at: '2026-04-02T12:00:00Z',
    updated_at: '2026-04-02T12:00:00Z',
  },
]

describe('MapView', () => {
  it('renders the map container', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={[]}
      />
    )
    expect(document.querySelector('.map-container')).toBeInTheDocument()
  })

  it('renders a marker for each site', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={mockSites}
      />
    )
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
  })

  it('renders score pins with site names as title', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={mockSites}
        siteScores={{ 'site-1': 87, 'site-2': 55 }}
      />
    )
    expect(screen.getByTitle('Sao Paulo')).toBeInTheDocument()
    expect(screen.getByTitle('Nairobi')).toBeInTheDocument()
  })

  it('calls onSelectSite when a marker is clicked', async () => {
    const user = userEvent.setup()
    const onSelectSite = vi.fn()
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={mockSites}
        onSelectSite={onSelectSite}
      />
    )
    const markers = screen.getAllByTestId('marker')
    await user.click(markers[0])
    expect(onSelectSite).toHaveBeenCalledWith('site-1')
  })

  it('calls onMapClick when clicking empty map area', async () => {
    const user = userEvent.setup()
    const onMapClick = vi.fn()
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={[]}
        onMapClick={onMapClick}
      />
    )
    await user.click(screen.getByTestId('map'))
    expect(onMapClick).toHaveBeenCalledWith({ latitude: 20.0, longitude: 10.0 })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/components/MapView/MapView.test.tsx
```

Expected: FAIL — `sites` prop not accepted by MapView

- [ ] **Step 4: Update MapView to render markers**

Replace `src/components/MapView/MapView.tsx`:

```typescript
import { useCallback } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ViewState, LatLon } from '../../types/map'
import type { Site } from '../../types/site'
import './MapView.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface MapViewProps {
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
  sites: Site[]
  siteScores?: Record<string, number>
  onSelectSite?: (siteId: string) => void
  onMapClick?: (coords: LatLon) => void
}

function pinColor(score: number | undefined): string {
  if (score === undefined) return '#64748b'
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function MapView({
  viewState,
  onViewStateChange,
  sites,
  siteScores,
  onSelectSite,
  onMapClick,
}: MapViewProps) {
  const handleMove = useCallback(
    (evt: { viewState: ViewState }) => {
      onViewStateChange(evt.viewState)
    },
    [onViewStateChange]
  )

  const handleClick = useCallback(
    (evt: { lngLat: { lng: number; lat: number } }) => {
      if (onMapClick) {
        onMapClick({ latitude: evt.lngLat.lat, longitude: evt.lngLat.lng })
      }
    },
    [onMapClick]
  )

  return (
    <div className="map-container">
      <Map
        {...viewState}
        onMove={handleMove}
        onClick={handleClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
      >
        <NavigationControl position="top-right" />
        {sites.map((site) => {
          const score = siteScores?.[site.id]
          const color = pinColor(score)
          return (
            <Marker
              key={site.id}
              longitude={site.longitude}
              latitude={site.latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                if (onSelectSite) onSelectSite(site.id)
              }}
            >
              <div className="score-pin" title={site.name} style={{ '--pin-color': color } as React.CSSProperties}>
                <span className="score-pin-label">{score !== undefined ? Math.round(score) : '–'}</span>
              </div>
            </Marker>
          )
        })}
      </Map>
    </div>
  )
}
```

- [ ] **Step 5: Add marker styles to MapView.css**

Replace `src/components/MapView/MapView.css`:

```css
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.score-pin {
  width: 36px;
  height: 36px;
  border-radius: 50% 50% 50% 0;
  background: var(--pin-color, #64748b);
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.score-pin-label {
  transform: rotate(45deg);
  color: white;
  font-size: 11px;
  font-weight: 700;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/components/MapView/MapView.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/components/MapView/ src/__mocks__/
git commit -m "feat: add site markers with score pins and click handlers to MapView"
```

---

### Task 6: Wire everything together in App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Replace `src/App.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Site } from './types/site'

const mockSite: Site = {
  id: 'site-1',
  name: 'Sao Paulo Station',
  slug: 'sao-paulo-station',
  latitude: -23.5505,
  longitude: -46.6333,
  status: 'approved',
  region: 'South America',
  country: 'Brazil',
  country_code: 'BR',
  notes: null,
  created_at: '2026-04-02T12:00:00Z',
  updated_at: '2026-04-02T12:00:00Z',
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => [mockSite],
  } as Response)
})

describe('App', () => {
  it('renders the search bar and map', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    expect(document.querySelector('.map-container')).toBeInTheDocument()
  })

  it('renders the toolbar with Add Site button', () => {
    render(<App />)
    expect(screen.getByText('+ Add Site')).toBeInTheDocument()
  })

  it('fetches and renders site markers on mount', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTitle('Sao Paulo Station')).toBeInTheDocument()
    })
  })

  it('opens create panel when Add Site is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText('+ Add Site'))
    expect(screen.getByText('Add New Site')).toBeInTheDocument()
  })

  it('closes panel when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText('+ Add Site'))
    expect(screen.getByText('Add New Site')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close panel'))
    expect(screen.queryByText('Add New Site')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/App.test.tsx
```

Expected: FAIL — App doesn't render Toolbar or fetch sites yet

- [ ] **Step 3: Update App to wire everything together**

Replace `src/App.tsx`:

```typescript
import { useCallback, useEffect, useState } from 'react'
import { MapView } from './components/MapView/MapView'
import { SearchBar } from './components/SearchBar/SearchBar'
import { Toolbar } from './components/Toolbar/Toolbar'
import { SitePanel } from './components/SitePanel/SitePanel'
import { fetchSites, fetchSiteScores, createSite } from './services/api'
import type { ViewState, SearchResult, LatLon } from './types/map'
import type { Site, SiteCreate } from './types/site'
import './App.css'

const INITIAL_VIEW: ViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
}

function App() {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW)
  const [sites, setSites] = useState<Site[]>([])
  const [siteScores, setSiteScores] = useState<Record<string, number>>({})
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'view' | 'create' | null>(null)
  const [createCoords, setCreateCoords] = useState<LatLon | null>(null)

  useEffect(() => {
    fetchSites().then((data) => {
      setSites(data)
      // Fetch composite scores for all sites
      data.forEach((site) => {
        fetchSiteScores(site.id).then((result) => {
          if (result.composite !== null) {
            setSiteScores((prev) => ({ ...prev, [site.id]: result.composite! }))
          }
        })
      })
    })
  }, [])

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.boundingBox) {
      const [south, north, west, east] = result.boundingBox
      const centerLat = (south + north) / 2
      const centerLon = (west + east) / 2
      const latDiff = Math.abs(north - south)
      const lonDiff = Math.abs(east - west)
      const maxDiff = Math.max(latDiff, lonDiff)
      const zoom = Math.max(2, Math.min(18, Math.floor(9 - Math.log2(maxDiff))))
      setViewState({ longitude: centerLon, latitude: centerLat, zoom })
    } else {
      setViewState({
        longitude: result.longitude,
        latitude: result.latitude,
        zoom: 10,
      })
    }
  }, [])

  const handleSelectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId)
    setPanelMode('view')
  }, [])

  const handleMapClick = useCallback((coords: LatLon) => {
    if (panelMode === null) {
      setCreateCoords(coords)
      setPanelMode('create')
    }
  }, [panelMode])

  const handleAddSite = useCallback(() => {
    setSelectedSiteId(null)
    setCreateCoords(null)
    setPanelMode('create')
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedSiteId(null)
    setPanelMode(null)
    setCreateCoords(null)
  }, [])

  const handleCreateSite = useCallback(async (data: SiteCreate) => {
    const newSite = await createSite(data)
    setSites((prev) => [...prev, newSite])
    setPanelMode(null)
    setCreateCoords(null)
  }, [])

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null

  return (
    <div className="app">
      <SearchBar onSelect={handleSearchSelect} />
      <Toolbar onAddSite={handleAddSite} />
      <MapView
        viewState={viewState}
        onViewStateChange={setViewState}
        sites={sites}
        siteScores={siteScores}
        onSelectSite={handleSelectSite}
        onMapClick={handleMapClick}
      />
      {panelMode && (
        <SitePanel
          mode={panelMode}
          site={selectedSite}
          createCoords={createCoords}
          onClose={handleClosePanel}
          onCreateSite={handleCreateSite}
        />
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/App.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 5: Run ALL tests**

```bash
npx vitest run
```

Expected: PASS — all frontend tests

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire sites, markers, toolbar, and panel together in App"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start the backend**

In a terminal:

```bash
cd C:\SatportProjects\SiteSearch\backend
conda activate sitesearch
uvicorn app.main:app --reload
```

Verify: http://localhost:8000/health returns `{"status":"ok"}`

- [ ] **Step 2: Start the frontend**

In a second terminal:

```bash
cd C:\SatportProjects\SiteSearch
npm run dev
```

Open http://localhost:5173 in the browser.

- [ ] **Step 3: Verify the dark-themed map loads**

Confirm: Dark search bar (top-left), dark "+ Add Site" button (top-right), full-screen map.

- [ ] **Step 4: Add a site via the API**

Using the backend Swagger UI at http://localhost:8000/docs:

POST `/api/sites` with:
```json
{
  "name": "Sao Paulo Station",
  "slug": "sao-paulo-station",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "status": "candidate",
  "region": "South America",
  "country": "Brazil",
  "country_code": "BR"
}
```

Refresh the frontend — a gray pin with "–" should appear near Sao Paulo.

- [ ] **Step 5: Add a score via the API**

POST `/api/sites/{site_id}/scores` with:
```json
{
  "category": "connectivity",
  "raw_score": 85,
  "source": "test"
}
```

Refresh the frontend — the pin should turn green and show "85".

- [ ] **Step 6: Test click-to-view**

Click the pin marker. Right side panel should appear showing site name, status, composite score, and connectivity bar.

- [ ] **Step 7: Test Add Site via button**

Click "+ Add Site". Form should appear in the right panel. Fill in name and coordinates, click "Create Site". New pin should appear on the map.

- [ ] **Step 8: Test Add Site via map click**

Close the panel. Click an empty spot on the map. Form should appear with lat/lon pre-filled. Create the site.

- [ ] **Step 9: Final commit**

```bash
cd C:\SatportProjects\SiteSearch
git add -A
git commit -m "feat: complete frontend-API wiring with sites, markers, detail panel, and create form"
```

---

## Summary

After completing all 7 tasks, the frontend will have:

| Component | What it does |
|-----------|-------------|
| API service | fetchSites, fetchSiteScores, createSite |
| Dark-themed SearchBar | Restyled to match dark UI |
| Toolbar | "+ Add Site" button, top-right |
| Score Pin markers | Color-coded pins on map with composite score |
| SitePanel (view) | Right side panel with scores, status, coordinates |
| SitePanel (create) | Form with auto-slug, pre-filled coords from map click |
| App integration | All state wired together, sites fetched on mount |

**Test count:** ~29 new/updated frontend tests + existing 12 = ~41 frontend tests total
