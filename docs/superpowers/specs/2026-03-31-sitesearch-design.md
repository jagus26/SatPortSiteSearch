# SiteSearch — Ground Station Site Selection Platform

## Purpose

SiteSearch is an interactive map-based tool for identifying, evaluating, and comparing potential satellite ground station sites worldwide. It enriches candidate locations with external and proprietary data across multiple categories, computes weighted scores, and presents results on an interactive map with structured and natural language search.

Core differentiator: fast, cheap, accurate site selection that lets the team engage with customers quickly.

## Users

- **Internal team** (engineering/sales): full CRUD, scoring configuration, data management, raw data access
- **Customers**: read-only filtered explorer with search, filter, and comparison capabilities

## Tech Stack

- **Backend:** FastAPI (Python)
- **Frontend:** React
- **Database:** PostgreSQL + PostGIS + pgvector
- **Map:** MapLibre GL JS (open source, no per-request costs)
- **Deployment:** Cloud-hosted SaaS (AWS/GCP/Azure)

## Data Model

### Site

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | Display name |
| slug | VARCHAR | URL-friendly identifier |
| latitude | FLOAT | |
| longitude | FLOAT | |
| geometry | PostGIS POINT/POLYGON | Spatial index |
| status | ENUM | candidate, under-review, approved, rejected |
| region | VARCHAR | |
| country | VARCHAR | |
| country_code | CHAR(2) | ISO 3166-1 |
| created_by | FK → User | |
| notes | TEXT | Internal only |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### SiteScore

One row per site per scoring category.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| site_id | FK → Site | |
| category | ENUM | connectivity, rf_satellite, infrastructure, regulatory, environmental, geopolitical |
| raw_score | INT (0-100) | Normalized score for this category |
| data_json | JSONB | Structured data backing the score |
| source | VARCHAR | Data source identifier |
| last_updated | TIMESTAMP | Staleness tracking |

### ScoreProfile

Saved weight configurations for reuse.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | e.g., "SE Asia Regulatory-Heavy" |
| description | TEXT | |
| weights_json | JSONB | e.g., `{"connectivity": 0.3, "regulatory": 0.25, ...}` |
| owner_type | ENUM | system, team, customer |
| created_by | FK → User | |

### Customer

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | |
| visible_site_ids | UUID[] | Sites this customer can access |

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email | VARCHAR | |
| role | ENUM | internal, customer |
| customer_id | FK → Customer | Nullable, set for customer users |
| password_hash | VARCHAR | bcrypt or argon2 |

## System Architecture

```
React Frontend (MapLibre GL, filters, site panels)
  │  Internal mode: full CRUD, scoring config
  │  Customer mode: read-only explorer
  │
  ▼ REST API (JSON)
FastAPI Backend
  ├── Sites API — CRUD, geospatial queries, bulk import/export
  ├── Scoring Engine — computes weighted composites on the fly
  ├── Search — structured filters (PostGIS) + NLP (pgvector)
  ├── Data Ingestion — adapter-based pipeline with scheduler
  ├── Auth — JWT, role-based access control
  └── Export — CSV/GeoJSON (internal), PDF summaries (customer)
  │
  ▼
PostgreSQL + PostGIS + pgvector
```

### Backend Modules

**Sites API** — CRUD for sites. Geospatial queries: sites within radius, within bounding box, within drawn polygon. Bulk import/export (CSV, GeoJSON).

**Scoring Engine** — computes weighted composite scores at query time. No precomputed composites. Accepts a score profile ID or ad-hoc weights. Formula: `composite = sum(raw_score[i] * weight[i]) / sum(weight[i])`.

**Search** — dual mode, single input box. Structured syntax (`country:Brazil score>70 connectivity>80 near:-23.5,-46.6,50km`) routes to SQL/PostGIS. Natural language routes to pgvector embedding similarity. Hybrid: structured filters narrow, NLP ranks within.

**Data Ingestion** — adapter pattern. Each adapter implements `fetch(site) → {data_json, raw_score}`. Scheduled via APScheduler or cron. Manual re-enrichment trigger via UI.

**Auth** — JWT tokens. Two roles: internal, customer. Customer requests filtered server-side to visible_site_ids.

### Frontend

Single React app. Components conditionally render based on `user.role`.

**Map** — MapLibre GL JS. Clustered markers color-coded by composite score (red/amber/green) or status. Draw-to-filter (rectangle/polygon). Click marker to open site detail panel.

**Site Detail Panel** — slide-out. Header with name, status badge, composite score. Radar/spider chart for 6 category scores. Expandable sections per category with underlying data. Internal mode adds edit, raw data view, score override, notes.

**Comparison View** — select 2-3 sites, side-by-side cards with overlaid radar charts. Highlights where sites differ most.

**Search & Filter Bar** — top bar with region dropdown, score range slider, category toggles, text input for structured/NLP queries. Results update map in real time.

### Feature Matrix: Internal vs Customer

| Feature | Internal | Customer |
|---|---|---|
| Add/edit sites | Yes | No |
| Configure score weights | Yes | No |
| See raw data sources | Yes | No |
| Export data | Full CSV/GeoJSON | Summary PDF |
| Notes & annotations | Yes | No |
| Filter & compare | Yes | Yes |
| Natural language search | Yes | Yes |

## Data Ingestion & Enrichment

### Adapter Pattern

Each scoring category has one or more adapters. Adapters implement a common interface:

```python
class BaseAdapter:
    category: ScoreCategory
    update_frequency: timedelta

    def fetch(self, site: Site) -> AdapterResult:
        """Returns structured data and a 0-100 raw score."""
        ...
```

### Initial Adapters

| Category | Sources | Update Frequency |
|---|---|---|
| Connectivity | PeeringDB (IXPs), submarine cable landing points, telecom infrastructure APIs | Weekly |
| RF/Satellite | ITU data, look angle calculations (from lat/lon), rain fade models | Monthly |
| Infrastructure | OpenStreetMap (power lines, roads), land use data | Monthly |
| Regulatory | ITU spectrum allocation, manual country-level assessments | Quarterly |
| Environmental | ERA5/weather APIs, natural disaster databases, SRTM terrain data | Monthly |
| Geopolitical | Country risk indices (manual + scraped), sanctions lists | Quarterly |

Proprietary data sources use the same adapter interface, reading from internal files, spreadsheets, or APIs.

### Score Computation

Each adapter defines its own sub-weight scoring logic. Example for connectivity:
- Distance to nearest fiber: 40%
- Number of IXPs within 50km: 30%
- Latency estimate to nearest major peering point: 30%

Sub-weights are internal to each adapter and documented.

### Staleness Tracking

Each SiteScore records `last_updated`. The UI shows a freshness indicator. Scores older than 2x their expected update frequency are flagged as stale.

## Search System

### Structured Search

Detects syntax patterns and routes to SQL/PostGIS:
- `country:Brazil` — exact field match
- `score>70` — composite score threshold (uses active weight profile)
- `connectivity>80` — category score filter
- `near:-23.5,-46.6,50km` — geospatial radius
- Combinable: `country:Brazil connectivity>80 score>70`

### Natural Language Search

1. Query embedded via LLM API (Claude or OpenAI embeddings)
2. Matched against pre-computed site embeddings (name + location + enrichment summary) via pgvector cosine similarity
3. Results ranked by similarity, filterable by active structured filters

### Embedding Maintenance

Embeddings regenerated as a post-ingestion step whenever a site's enrichment data is updated.

### v1 Scope

Start with structured search only. NLP search is a fast-follow. pgvector extension installed from day one so the schema is ready.

## Auth & Multi-tenancy

### v1 — Role-Based Access

- Two roles: `internal`, `customer`
- JWT tokens issued by backend
- Internal: username/password (SSO later)
- Customer: accounts created by internal team, scoped to `visible_site_ids`
- All API endpoints check role. Customer requests filtered server-side.

### v2 — Multi-tenancy Path

- Add `tenant_id` to customers, `site_tenants` join table
- PostgreSQL Row-Level Security (RLS) at DB layer
- Tenant-scoped score profiles
- Schema migration + RLS policies, not a rewrite

### v2 — API Key Access

- Programmatic access for customers
- Same visibility rules as UI login

### Deferred

- SSO/SAML integration
- Fine-grained per-category permissions
- Audit logging

## Scale Considerations

- Dozens of curated sites (not thousands)
- Rich data per site is the priority over volume
- Single-region cloud deployment for v1
- PostGIS spatial indexes handle the query patterns efficiently at this scale
- No need for caching layers, search clusters, or CDN in v1
