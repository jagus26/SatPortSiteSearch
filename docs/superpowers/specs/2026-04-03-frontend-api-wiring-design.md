# Frontend-API Wiring — Design Spec

## Purpose

Connect the React frontend to the FastAPI backend so sites appear on the map, users can view site details with scores, and internal users can create new candidate sites. This is the first pass — read + create only. Edit, delete, weight config, and enrichment triggers are deferred.

## Scope

- Fetch all sites from the API and render as markers on the map
- Click a marker to open a detail panel showing scores
- Create new sites via click-on-map or toolbar button
- Dark-themed UI chrome (search bar, panels, toolbar)

Out of scope: edit/delete sites, score weight configuration, adapter enrichment triggers, auth-gated UI, customer read-only mode.

## Visual Design

### Theme

Dark UI chrome against light map tiles (OpenFreeMap Liberty).

- **Panels/toolbar:** `#1e293b` (slate-800) background, `#334155` borders
- **Text:** `#f1f5f9` (primary), `#94a3b8` (secondary), `#64748b` (muted)
- **Accents:** green `#22c55e` (score ≥ 70), amber `#f59e0b` (40–69), red `#ef4444` (< 40)
- **Search bar:** Dark background to match, replacing current white
- **Map:** Stays light-themed (Liberty tiles)

### Map Markers — Score Pins

Each site renders as a pin-shaped marker on the map:

- **Shape:** Teardrop/pin (circle with pointed bottom)
- **Color:** Green/amber/red based on composite score thresholds (≥70 / 40–69 / <40)
- **Label:** Composite score number (integer) displayed inside the pin in white bold text
- **No score yet:** Gray pin with "–" label
- **Hover:** Show site name tooltip
- **Click:** Open right side panel with full detail
- **Clustering:** Not needed for v1 (dozens of sites, not thousands)

### Right Side Panel

Slides in from the right when a marker is clicked or "Add Site" is triggered. Width: 360px. Map does not resize — panel overlays the right edge.

**View mode (click existing site):**

```
┌─────────────────────────┐
│ Site Name            ✕  │
│ [approved] [Brazil]     │
│                         │
│         87              │
│    composite score      │
│                         │
│ Connectivity    ████ 90 │
│ Environmental   ███  75 │
│ Infrastructure  ████ 85 │
│ Regulatory      ████ 92 │
│ RF / Satellite  ████ 80 │
│ Geopolitical    ████ 88 │
│                         │
│ -23.55, -46.63 · S.Am.  │
└─────────────────────────┘
```

- Header: site name + close button (✕)
- Status badge (color-coded) + country badge
- Large composite score (color-coded)
- 6 category score bars with labels and numbers
- Footer: coordinates and region

**Create mode (add new site):**

```
┌─────────────────────────┐
│ Add New Site         ✕  │
│                         │
│ Name      [___________] │
│ Slug      [___________] │
│ Latitude  [-23.5505   ] │
│ Longitude [-46.6333   ] │
│ Region    [___________] │
│ Country   [___________] │
│ Code      [__]          │
│ Notes     [___________] │
│                         │
│       [ Create Site ]   │
└─────────────────────────┘
```

- Pre-filled lat/lon when triggered by map click
- Empty when triggered by toolbar button
- Slug auto-generated from name (kebab-case)
- Status defaults to "candidate" (not shown in form)
- On success: close panel, new pin appears on map

### Toolbar

Horizontal bar at the top-right of the map (below nav controls, next to search bar area):

- **"+ Add Site" button** — opens right panel in create mode
- Dark themed to match panels
- Positioned so it doesn't overlap the search bar (top-left)

### Search Bar Update

Restyle the existing search bar from white to dark theme to match the new UI:

- Background: `#1e293b` with `#334155` border
- Text: `#f1f5f9`
- Placeholder: `#64748b`
- Dropdown results: same dark theme
- Functionality unchanged

## Architecture

### Data Flow

```
App (state: sites[], selectedSiteId, panelMode)
  ├── SearchBar (unchanged behavior)
  ├── Toolbar (onAddSite callback)
  ├── MapView
  │     ├── receives sites[] as prop
  │     ├── renders score pin markers via MapLibre layers
  │     ├── onClick marker → onSelectSite(id)
  │     └── onClick empty map → onMapClick(lat, lon)
  └── SitePanel
        ├── view mode: fetches scores, displays detail
        └── create mode: form, calls POST /api/sites
```

### State Management

Keep it simple — React hooks in App, no external state library.

**App-level state:**
- `sites: Site[]` — all sites, fetched on mount
- `selectedSiteId: string | null` — which site's detail is showing
- `panelMode: 'view' | 'create' | null` — right panel state
- `createCoords: {lat, lon} | null` — pre-fill for map-click creation

### API Integration

New `src/services/api.ts` module:

```typescript
const API_BASE = 'http://localhost:8000'

async function fetchSites(): Promise<Site[]>
// GET /api/sites

async function fetchSiteScores(siteId: string): Promise<CompositeScore>
// GET /api/sites/{id}/scores

async function createSite(data: SiteCreate): Promise<Site>
// POST /api/sites
```

No auth headers for now — auth UI is deferred.

### TypeScript Types

Extend `src/types/map.ts` (or create `src/types/site.ts`):

```typescript
interface Site {
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

interface SiteCreate {
  name: string
  slug: string
  latitude: number
  longitude: number
  region?: string
  country?: string
  country_code?: string
  notes?: string
}

interface CompositeScore {
  site_id: string
  composite: number | null
  scores: Record<string, number>
}
```

### Component Breakdown

**New components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `SitePanel` | `src/components/SitePanel/` | Right side panel (view + create modes) |
| `SiteDetail` | inside SitePanel | View mode content (scores, info) |
| `SiteForm` | inside SitePanel | Create mode form |
| `Toolbar` | `src/components/Toolbar/` | Top-right bar with "Add Site" button |
| `ScoreBar` | `src/components/SitePanel/` | Reusable score bar (label + bar + number) |

**Modified components:**

| Component | Changes |
|-----------|---------|
| `App` | Add sites state, API calls on mount, panel state, callbacks |
| `MapView` | Accept sites prop, render markers, handle click events |
| `SearchBar` | Restyle to dark theme (CSS only) |

### Map Markers Implementation

Use react-map-gl `Marker` components (HTML overlays) — simpler and sufficient for dozens of sites. Each `Marker` renders a styled div (the score pin) at the site's coordinates.

- Pin color computed from composite score
- Click handler on each marker calls `onSelectSite(id)`
- Click handler on the map (not on a marker) calls `onMapClick(lat, lon)`
- If site count grows to hundreds, migrate to GeoJSON Source + Layer for performance

### CORS

Backend already has CORS configured for `http://localhost:5173` (Vite dev server). No changes needed.

## Testing Strategy

**API service tests** (`src/services/api.test.ts`):
- Mock fetch calls, verify URL construction and response parsing
- Test error handling (network failure, 404)

**SitePanel tests:**
- View mode renders site name, scores, status
- Create mode form submits correct data
- Panel closes on ✕ click

**MapView marker tests:**
- Sites render as markers (verify Marker components for each site)
- Click marker calls onSelectSite with correct id
- Click empty map calls onMapClick with coordinates

**App integration tests:**
- Sites fetched on mount
- Selecting a site opens panel in view mode
- "Add Site" opens panel in create mode
- Creating a site adds it to the sites list

## Error Handling

- **API unreachable:** Show a subtle banner at top: "Backend unavailable — running in offline mode". Map still works, just no sites loaded.
- **Create fails:** Show inline error in the form panel.
- **Scores not available:** Show "No scores yet" in detail panel with gray bars.

## Deferred

- Edit/delete site from UI
- Score weight configuration
- Trigger adapter enrichment from UI
- Auth-gated UI (login, role-based rendering)
- Customer read-only mode
- Site clustering at low zoom levels
- Animated panel transitions
