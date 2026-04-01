# Map UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive world map UI where users can view the globe, search for regions by name, and navigate by latitude/longitude coordinates.

**Architecture:** Vite + React + TypeScript frontend with MapLibre GL JS for map rendering. Nominatim (OpenStreetMap) for geocoding/region search. OpenFreeMap for free vector tiles with no API key. Simple component structure: App shell, Map, and SearchBar.

**Tech Stack:** Vite, React 18+, TypeScript, MapLibre GL JS (maplibre-gl), react-map-gl/maplibre, Nominatim API, OpenFreeMap tiles

**Spec:** `docs/superpowers/specs/2026-03-31-sitesearch-design.md`

---

## File Structure

```
src/
  main.tsx                  — React entry point
  index.css                 — Global reset styles (html/body full height)
  App.tsx                   — App shell, layout
  App.css                   — App layout styles
  App.test.tsx              — App integration tests
  test-setup.ts             — Vitest setup (jest-dom)
  __mocks__/
    react-map-gl/
      maplibre.tsx          — Mock for react-map-gl/maplibre (test-only, jsdom has no WebGL)
  components/
    MapView/
      MapView.tsx           — MapLibre map component (react-map-gl wrapper)
      MapView.test.tsx      — MapView unit tests
      MapView.css           — Map-specific styles
    SearchBar/
      SearchBar.tsx         — Search input with region name + lat/lon support
      SearchBar.test.tsx    — SearchBar unit tests (rendering + coordinates)
      SearchBar.search.test.tsx — SearchBar name search tests (mocked geocoding)
      SearchBar.css         — Search bar styles
  services/
    geocoding.ts            — Nominatim API client
    geocoding.test.ts       — Geocoding service tests
  types/
    map.ts                  — Shared types (ViewState, SearchResult, etc.)
index.html                  — Vite HTML entry
vite.config.ts              — Vite config
tsconfig.json               — TypeScript config
package.json                — Dependencies and scripts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd C:/SatportProjects/SiteSearch
npm create vite@latest . -- --template react-ts
```

If the directory is not empty, say yes to overwrite. This creates the base project structure.

- [ ] **Step 2: Install map dependencies**

```bash
npm install react-map-gl maplibre-gl
```

- [ ] **Step 3: Install dev/test dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 4: Configure Vitest**

Replace `vite.config.ts` with the following. Note: use `vitest/config` instead of `vite` so the `test` property is typed correctly:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
    alias: {
      'react-map-gl/maplibre': path.resolve(__dirname, 'src/__mocks__/react-map-gl/maplibre.tsx'),
    },
  },
})
```

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

Ensure `package.json` scripts include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 6: Clean up template defaults and set up index.css**

The Vite template creates default files (`src/assets/`, default CSS content) that we don't need. Replace `src/index.css` with our global reset:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
}
```

Delete `src/assets/` directory if it was created by the template. Remove any default Vite logo/counter content from `src/App.tsx` and `src/App.css` (they will be replaced in Task 6, but clear them now so the build doesn't depend on deleted assets).

- [ ] **Step 7: Verify scaffolding works**

```bash
npm run build
npm run test:run
```

Expected: Build succeeds, test runner starts (0 tests or default test passes).

- [ ] **Step 8: Commit**

```bash
git init
echo "node_modules/\ndist/\n.superpowers/" > .gitignore
git add .
git commit -m "chore: scaffold Vite + React + TypeScript project with MapLibre and Vitest"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/types/map.ts`

- [ ] **Step 1: Define shared types**

Create `src/types/map.ts`:

```typescript
export interface ViewState {
  longitude: number
  latitude: number
  zoom: number
}

export interface SearchResult {
  displayName: string
  latitude: number
  longitude: number
  boundingBox: [number, number, number, number] | null // [south, north, west, east]
  type: 'place' | 'coordinates'
}

export interface LatLon {
  latitude: number
  longitude: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/map.ts
git commit -m "feat: add shared map types (ViewState, SearchResult, LatLon)"
```

---

### Task 3: Geocoding Service

**Files:**
- Create: `src/services/geocoding.ts`, `src/services/geocoding.test.ts`

- [ ] **Step 1: Write failing tests for geocoding service**

Create `src/services/geocoding.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchByName, parseCoordinates } from './geocoding'

describe('parseCoordinates', () => {
  it('parses "lat, lon" format', () => {
    const result = parseCoordinates('51.5074, -0.1278')
    expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 })
  })

  it('parses "lat lon" format (space separated)', () => {
    const result = parseCoordinates('51.5074 -0.1278')
    expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 })
  })

  it('returns null for non-coordinate strings', () => {
    expect(parseCoordinates('London')).toBeNull()
    expect(parseCoordinates('hello world')).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(parseCoordinates('91, 0')).toBeNull()
    expect(parseCoordinates('0, 181')).toBeNull()
  })
})

describe('searchByName', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns search results from Nominatim', async () => {
    const mockResponse = [
      {
        display_name: 'London, England, United Kingdom',
        lat: '51.5074',
        lon: '-0.1278',
        boundingbox: ['51.2867', '51.6919', '-0.5103', '0.3340'],
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const results = await searchByName('London')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      displayName: 'London, England, United Kingdom',
      latitude: 51.5074,
      longitude: -0.1278,
      boundingBox: [51.2867, 51.6919, -0.5103, 0.3340],
      type: 'place',
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org/search')
    )
  })

  it('returns empty array on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const results = await searchByName('London')
    expect(results).toEqual([])
  })

  it('returns empty array for empty query', async () => {
    const results = await searchByName('')
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/geocoding.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement geocoding service**

Create `src/services/geocoding.ts`:

```typescript
import type { SearchResult, LatLon } from '../types/map'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

export function parseCoordinates(input: string): LatLon | null {
  const cleaned = input.trim()

  // Match "lat, lon" or "lat lon"
  const match = cleaned.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
  if (!match) return null

  const latitude = parseFloat(match[1])
  const longitude = parseFloat(match[2])

  if (latitude < -90 || latitude > 90) return null
  if (longitude < -180 || longitude > 180) return null

  return { latitude, longitude }
}

export async function searchByName(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
    })

    const response = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: { 'User-Agent': 'SiteSearch/1.0' },
    })

    if (!response.ok) return []

    const data = await response.json()

    return data.map((item: Record<string, unknown>) => ({
      displayName: item.display_name as string,
      latitude: parseFloat(item.lat as string),
      longitude: parseFloat(item.lon as string),
      boundingBox: (item.boundingbox as string[])?.map(Number) as
        | [number, number, number, number]
        | null,
      type: 'place' as const,
    }))
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/geocoding.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/ src/types/
git commit -m "feat: add geocoding service with Nominatim integration and coordinate parsing"
```

---

### Task 4: MapView Component

**Files:**
- Create: `src/components/MapView/MapView.tsx`, `src/components/MapView/MapView.css`, `src/components/MapView/MapView.test.tsx`

- [ ] **Step 1: Write failing test for MapView**

Create `src/components/MapView/MapView.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapView } from './MapView'

describe('MapView', () => {
  it('renders the map container', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
      />
    )
    const container = document.querySelector('.map-container')
    expect(container).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/MapView/MapView.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create react-map-gl mock for tests**

jsdom has no WebGL context, so react-map-gl/maplibre will fail in tests. This mock is required. It is scoped to tests only via the `test.alias` in `vite.config.ts` (configured in Task 1 Step 4) — it does NOT affect `npm run dev` or production builds.

Create `src/__mocks__/react-map-gl/maplibre.tsx`:

```typescript
import { forwardRef } from 'react'

const Map = forwardRef(({ children, ...props }: Record<string, unknown>, ref) => (
  <div data-testid="map" ref={ref as React.Ref<HTMLDivElement>} {...props}>
    {children as React.ReactNode}
  </div>
))
Map.displayName = 'MockMap'

export default Map
export const NavigationControl = () => <div data-testid="navigation-control" />
```

- [ ] **Step 4: Implement MapView component**

Create `src/components/MapView/MapView.css`:

```css
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
}
```

Create `src/components/MapView/MapView.tsx`:

```typescript
import { useCallback } from 'react'
import Map, { NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ViewState } from '../../types/map'
import './MapView.css'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface MapViewProps {
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
}

export function MapView({ viewState, onViewStateChange }: MapViewProps) {
  const handleMove = useCallback(
    (evt: { viewState: ViewState }) => {
      onViewStateChange(evt.viewState)
    },
    [onViewStateChange]
  )

  return (
    <div className="map-container">
      <Map
        {...viewState}
        onMove={handleMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
      >
        <NavigationControl position="top-right" />
      </Map>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/components/MapView/MapView.test.tsx
```

Expected: PASS (the mock from Step 3 handles the WebGL dependency).

- [ ] **Step 6: Commit**

```bash
git add src/__mocks__/ src/components/MapView/
git commit -m "feat: add MapView component with MapLibre GL and OpenFreeMap tiles"
```

---

### Task 5: SearchBar Component

**Files:**
- Create: `src/components/SearchBar/SearchBar.tsx`, `src/components/SearchBar/SearchBar.css`, `src/components/SearchBar/SearchBar.test.tsx`

- [ ] **Step 1: Write failing tests for SearchBar (rendering and coordinates)**

Create `src/components/SearchBar/SearchBar.test.tsx`. This file tests rendering and coordinate input — it does NOT mock the geocoding service:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('renders the search input', () => {
    render(<SearchBar onSelect={() => {}} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('shows coordinate result for valid lat/lon input', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SearchBar onSelect={onSelect} />)

    const input = screen.getByPlaceholderText(/search/i)
    await user.type(input, '51.5074, -0.1278')
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 51.5074,
        longitude: -0.1278,
        type: 'coordinates',
      })
    )
  })
})
```

Create a separate file `src/components/SearchBar/SearchBar.search.test.tsx` for the name search test. This file uses `vi.mock` at the top level, so the mock applies to all tests in this file only (no hoisting conflict with the other test file):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../services/geocoding', () => ({
  searchByName: vi.fn().mockResolvedValue([
    {
      displayName: 'London, England, United Kingdom',
      latitude: 51.5074,
      longitude: -0.1278,
      boundingBox: [51.2867, 51.6919, -0.5103, 0.334] as [number, number, number, number],
      type: 'place' as const,
    },
  ]),
  parseCoordinates: vi.fn().mockReturnValue(null),
}))

import { SearchBar } from './SearchBar'

describe('SearchBar name search', () => {
  it('displays dropdown results for name search', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSelect={() => {}} />)

    const input = screen.getByPlaceholderText(/search/i)
    await user.type(input, 'London')

    // Wait for debounced results
    const result = await screen.findByText(/London, England/i)
    expect(result).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SearchBar/
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SearchBar component**

Create `src/components/SearchBar/SearchBar.css`:

```css
.search-bar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  width: 360px;
  font-family: system-ui, sans-serif;
}

.search-bar input {
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.search-bar input:focus {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}

.search-results {
  margin-top: 4px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.search-result-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #eee;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #f5f5f5;
}
```

Create `src/components/SearchBar/SearchBar.tsx`:

```typescript
import { useState, useCallback, useEffect, useRef } from 'react'
import { searchByName, parseCoordinates } from '../../services/geocoding'
import type { SearchResult } from '../../types/map'
import './SearchBar.css'

interface SearchBarProps {
  onSelect: (result: SearchResult) => void
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setResults([])
        setIsOpen(false)
        return
      }

      const coords = parseCoordinates(value)
      if (coords) {
        setResults([
          {
            displayName: `${coords.latitude}, ${coords.longitude}`,
            latitude: coords.latitude,
            longitude: coords.longitude,
            boundingBox: null,
            type: 'coordinates',
          },
        ])
        setIsOpen(true)
        return
      }

      const searchResults = await searchByName(value)
      setResults(searchResults)
      setIsOpen(searchResults.length > 0)
    },
    []
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      handleSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, handleSearch])

  const handleSelect = (result: SearchResult) => {
    setQuery(result.displayName)
    setIsOpen(false)
    onSelect(result)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const coords = parseCoordinates(query)
      if (coords) {
        handleSelect({
          displayName: `${coords.latitude}, ${coords.longitude}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          boundingBox: null,
          type: 'coordinates',
        })
      } else if (results.length > 0) {
        handleSelect(results[0])
      }
    }
  }

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search region name or enter lat, lon..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((result, index) => (
            <div
              key={index}
              className="search-result-item"
              onClick={() => handleSelect(result)}
            >
              {result.displayName}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/SearchBar/
```

Expected: All 3 tests PASS across both test files.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar/
git commit -m "feat: add SearchBar with region name search and lat/lon coordinate input"
```

---

### Task 6: App Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing test for App integration**

Create `src/App.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the search bar and map', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    expect(document.querySelector('.map-container')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/App.test.tsx
```

Expected: FAIL — App doesn't contain SearchBar/MapView yet.

- [ ] **Step 3: Implement App integration**

Replace `src/App.css`:

```css
#root {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
}
```

Replace `src/App.tsx`:

```typescript
import { useCallback, useState } from 'react'
import { MapView } from './components/MapView/MapView'
import { SearchBar } from './components/SearchBar/SearchBar'
import type { ViewState, SearchResult } from './types/map'
import './App.css'

const INITIAL_VIEW: ViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
}

function App() {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW)

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.boundingBox) {
      // For places with bounding boxes, center on the result with appropriate zoom
      const [south, north, west, east] = result.boundingBox
      const centerLat = (south + north) / 2
      const centerLon = (west + east) / 2
      // Rough zoom calculation from bounding box
      const latDiff = Math.abs(north - south)
      const lonDiff = Math.abs(east - west)
      const maxDiff = Math.max(latDiff, lonDiff)
      const zoom = Math.max(2, Math.min(18, Math.floor(9 - Math.log2(maxDiff))))

      setViewState({ longitude: centerLon, latitude: centerLat, zoom })
    } else {
      // For coordinates, fly to the point at zoom 10
      setViewState({
        longitude: result.longitude,
        latitude: result.latitude,
        zoom: 10,
      })
    }
  }, [])

  return (
    <div className="app">
      <SearchBar onSelect={handleSearchSelect} />
      <MapView viewState={viewState} onViewStateChange={setViewState} />
    </div>
  )
}

export default App
```

Note: `src/index.css` was already set up with the global reset in Task 1 Step 6.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Open `http://localhost:5173` in browser. Verify:
1. World map displays with OpenFreeMap tiles
2. Map is pannable and zoomable
3. Search bar appears in top-left corner
4. Typing a region name (e.g., "Kenya") shows dropdown results from Nominatim
5. Clicking a result flies the map to that region
6. Typing coordinates (e.g., "51.5074, -0.1278") and pressing Enter flies to that location

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css src/App.test.tsx
git commit -m "feat: integrate MapView and SearchBar into App with fly-to navigation"
```

---

## Summary

After completing all 6 tasks you will have:
- A Vite + React + TypeScript project with Vitest testing
- An interactive MapLibre world map with OpenFreeMap tiles
- A search bar that accepts region names (geocoded via Nominatim) and lat/lon coordinates
- Fly-to navigation when a search result is selected
- Full test coverage for the geocoding service and component rendering
