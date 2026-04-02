# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI backend with database models, Sites CRUD API, scoring engine, two data adapters (NASA POWER, PeeringDB), and JWT auth.

**Architecture:** FastAPI app under `backend/` with SQLModel ORM, async PostgreSQL via asyncpg, adapter-pattern data ingestion. Tests use pytest-asyncio with a test database. The frontend (`src/`) is untouched in this plan.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, asyncpg, PostgreSQL + PostGIS, httpx, pydantic-settings, pytest, pytest-asyncio

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app factory, router mounting
│   ├── config.py                  # Settings via pydantic-settings
│   ├── database.py                # Async engine, session factory
│   ├── models/
│   │   ├── __init__.py
│   │   ├── site.py                # Site, SiteStatus
│   │   ├── score.py               # SiteScore, ScoreCategory
│   │   ├── profile.py             # ScoreProfile, OwnerType
│   │   └── user.py                # User, Customer, UserRole
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── sites.py               # Sites CRUD + geospatial endpoints
│   │   ├── scores.py              # Scoring endpoints
│   │   └── auth.py                # Login, token refresh
│   ├── services/
│   │   ├── __init__.py
│   │   ├── scoring.py             # Weighted composite computation
│   │   └── auth.py                # JWT creation, password hashing
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── base.py                # BaseAdapter interface
│   │   ├── nasa_power.py          # NASA POWER environmental adapter
│   │   └── peeringdb.py           # PeeringDB connectivity adapter
│   └── schemas/
│       ├── __init__.py
│       ├── site.py                # Request/response schemas for sites
│       ├── score.py               # Request/response schemas for scores
│       └── auth.py                # Login request, token response
├── tests/
│   ├── __init__.py
│   ├── conftest.py                # Test DB fixtures, async session
│   ├── test_site_model.py         # Site model tests
│   ├── test_sites_api.py          # Sites CRUD endpoint tests
│   ├── test_scoring.py            # Scoring engine tests
│   ├── test_nasa_power.py         # NASA POWER adapter tests
│   ├── test_peeringdb.py          # PeeringDB adapter tests
│   └── test_auth.py               # Auth endpoint tests
├── alembic/
│   ├── env.py
│   └── versions/                  # Migration scripts
├── alembic.ini
├── pyproject.toml                 # Python project config + deps
└── pytest.ini                     # Pytest config
```

---

### Task 1: Project scaffolding and config

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`
- Create: `backend/pyproject.toml`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/.env`

- [ ] **Step 1: Create backend directory structure**

```bash
cd C:\SatportProjects\SiteSearch
mkdir -p backend/app/models backend/app/routers backend/app/services backend/app/adapters backend/app/schemas backend/tests
```

- [ ] **Step 2: Create pyproject.toml**

Create `backend/pyproject.toml`:

```toml
[project]
name = "sitesearch-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "sqlmodel>=0.0.22",
    "asyncpg>=0.30",
    "httpx>=0.28",
    "pydantic-settings>=2.7",
    "psycopg[binary]>=3.2",
    "python-jose[cryptography]>=3.3",
    "passlib[bcrypt]>=1.7",
    "alembic>=1.14",
    "geoalchemy2>=0.17",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.25",
    "pytest-cov>=6.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: Create .env file**

Create `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD_HERE@localhost:5432/sitesearch
DATABASE_URL_SYNC=postgresql+psycopg://postgres:YOUR_PASSWORD_HERE@localhost:5432/sitesearch
SECRET_KEY=dev-secret-key-change-in-production
```

- [ ] **Step 4: Create config.py**

Create `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sitesearch"
    database_url_sync: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sitesearch"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 60
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 5: Create database.py**

Create `backend/app/database.py`:

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session():
    async with async_session() as session:
        yield session


async def create_db_tables():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
```

- [ ] **Step 6: Create main.py**

Create `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_db_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_tables()
    yield


app = FastAPI(title="SiteSearch API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Create empty __init__.py files**

Create empty `__init__.py` in:
- `backend/app/__init__.py`
- `backend/app/models/__init__.py`
- `backend/app/routers/__init__.py`
- `backend/app/services/__init__.py`
- `backend/app/adapters/__init__.py`
- `backend/app/schemas/__init__.py`
- `backend/tests/__init__.py`

- [ ] **Step 8: Create pytest.ini**

Create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 9: Create test conftest with DB fixtures**

Create `backend/tests/conftest.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

from app.config import settings
from app.database import get_session
from app.main import app

TEST_DATABASE_URL = settings.database_url.replace("/sitesearch", "/sitesearch_test")

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.fixture
async def session():
    async with test_session() as session:
        yield session


@pytest.fixture
async def client(session):
    async def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
```

- [ ] **Step 10: Create the test database**

```bash
psql -U postgres -c "CREATE DATABASE sitesearch_test;"
psql -U postgres -d sitesearch_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

- [ ] **Step 11: Write the health check test**

Create `backend/tests/test_health.py`:

```python
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 12: Run the test**

```bash
cd C:\SatportProjects\SiteSearch\backend
conda activate sitesearch
pip install python-jose[cryptography] passlib[bcrypt] geoalchemy2 alembic
pytest tests/test_health.py -v
```

Expected: PASS

- [ ] **Step 13: Verify the server starts**

```bash
cd C:\SatportProjects\SiteSearch\backend
uvicorn app.main:app --reload
```

Open http://localhost:8000/health in browser — should return `{"status":"ok"}`.
Open http://localhost:8000/docs — should show Swagger UI.
Stop the server with Ctrl+C.

- [ ] **Step 14: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add FastAPI backend scaffolding with config, database, and health check"
```

---

### Task 2: Database models (Site, SiteScore, ScoreProfile)

**Files:**
- Create: `backend/app/models/site.py`
- Create: `backend/app/models/score.py`
- Create: `backend/app/models/profile.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/test_site_model.py`

- [ ] **Step 1: Write failing test for Site model**

Create `backend/tests/test_site_model.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlmodel import select

from app.models.site import Site, SiteStatus


async def test_create_site(session):
    site = Site(
        name="Test Ground Station",
        slug="test-ground-station",
        latitude=-23.5505,
        longitude=-46.6333,
        status=SiteStatus.candidate,
        region="South America",
        country="Brazil",
        country_code="BR",
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    assert site.id is not None
    assert isinstance(site.id, uuid.UUID)
    assert site.name == "Test Ground Station"
    assert site.status == SiteStatus.candidate
    assert site.created_at is not None


async def test_site_status_values():
    assert SiteStatus.candidate == "candidate"
    assert SiteStatus.under_review == "under-review"
    assert SiteStatus.approved == "approved"
    assert SiteStatus.rejected == "rejected"


async def test_query_site_by_country(session):
    site = Site(
        name="Sao Paulo",
        slug="sao-paulo",
        latitude=-23.5505,
        longitude=-46.6333,
        status=SiteStatus.candidate,
        country="Brazil",
        country_code="BR",
    )
    session.add(site)
    await session.commit()

    result = await session.exec(select(Site).where(Site.country_code == "BR"))
    found = result.first()
    assert found is not None
    assert found.name == "Sao Paulo"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:\SatportProjects\SiteSearch\backend
pytest tests/test_site_model.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.site'`

- [ ] **Step 3: Create Site model**

Create `backend/app/models/site.py`:

```python
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class SiteStatus(str, enum.Enum):
    candidate = "candidate"
    under_review = "under-review"
    approved = "approved"
    rejected = "rejected"


class Site(SQLModel, table=True):
    __tablename__ = "sites"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    slug: str = Field(index=True, unique=True)
    latitude: float
    longitude: float
    status: SiteStatus = Field(default=SiteStatus.candidate)
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = Field(default=None, max_length=2)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_site_model.py -v
```

Expected: PASS (3 tests)

- [ ] **Step 5: Write failing test for SiteScore model**

Add to `backend/tests/test_site_model.py`:

```python
from app.models.score import SiteScore, ScoreCategory


async def test_create_site_score(session):
    site = Site(
        name="Test Site",
        slug="test-site-score",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    score = SiteScore(
        site_id=site.id,
        category=ScoreCategory.connectivity,
        raw_score=85,
        data_json={"ixp_count": 3, "nearest_fiber_km": 12.5},
        source="peeringdb",
    )
    session.add(score)
    await session.commit()
    await session.refresh(score)

    assert score.id is not None
    assert score.raw_score == 85
    assert score.category == ScoreCategory.connectivity
    assert score.data_json["ixp_count"] == 3


async def test_score_categories():
    categories = [c.value for c in ScoreCategory]
    assert "connectivity" in categories
    assert "rf_satellite" in categories
    assert "infrastructure" in categories
    assert "regulatory" in categories
    assert "environmental" in categories
    assert "geopolitical" in categories
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pytest tests/test_site_model.py::test_create_site_score -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.score'`

- [ ] **Step 7: Create SiteScore model**

Create `backend/app/models/score.py`:

```python
import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON


class ScoreCategory(str, enum.Enum):
    connectivity = "connectivity"
    rf_satellite = "rf_satellite"
    infrastructure = "infrastructure"
    regulatory = "regulatory"
    environmental = "environmental"
    geopolitical = "geopolitical"


class SiteScore(SQLModel, table=True):
    __tablename__ = "site_scores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    site_id: uuid.UUID = Field(foreign_key="sites.id", index=True)
    category: ScoreCategory
    raw_score: int = Field(ge=0, le=100)
    data_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    source: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
pytest tests/test_site_model.py -v
```

Expected: PASS (5 tests)

- [ ] **Step 9: Create ScoreProfile model**

Create `backend/app/models/profile.py`:

```python
import enum
import uuid
from typing import Any, Optional

from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON


class OwnerType(str, enum.Enum):
    system = "system"
    team = "team"
    customer = "customer"


class ScoreProfile(SQLModel, table=True):
    __tablename__ = "score_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    description: Optional[str] = None
    weights_json: dict[str, float] = Field(
        default_factory=lambda: {
            "connectivity": 1.0,
            "rf_satellite": 1.0,
            "infrastructure": 1.0,
            "regulatory": 1.0,
            "environmental": 1.0,
            "geopolitical": 1.0,
        },
        sa_column=Column(JSON),
    )
    owner_type: OwnerType = Field(default=OwnerType.team)
```

- [ ] **Step 10: Update models __init__.py to import all models**

Update `backend/app/models/__init__.py`:

```python
from app.models.site import Site, SiteStatus
from app.models.score import SiteScore, ScoreCategory
from app.models.profile import ScoreProfile, OwnerType

__all__ = [
    "Site",
    "SiteStatus",
    "SiteScore",
    "ScoreCategory",
    "ScoreProfile",
    "OwnerType",
]
```

- [ ] **Step 11: Run all model tests**

```bash
pytest tests/test_site_model.py -v
```

Expected: PASS (5 tests)

- [ ] **Step 12: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add Site, SiteScore, and ScoreProfile database models"
```

---

### Task 3: Site schemas and Sites CRUD API

**Files:**
- Create: `backend/app/schemas/site.py`
- Create: `backend/app/routers/sites.py`
- Modify: `backend/app/main.py` (mount router)
- Create: `backend/tests/test_sites_api.py`

- [ ] **Step 1: Write failing tests for Sites API**

Create `backend/tests/test_sites_api.py`:

```python
import uuid


async def test_create_site(client):
    response = await client.post("/api/sites", json={
        "name": "Sao Paulo Station",
        "slug": "sao-paulo-station",
        "latitude": -23.5505,
        "longitude": -46.6333,
        "status": "candidate",
        "region": "South America",
        "country": "Brazil",
        "country_code": "BR",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Sao Paulo Station"
    assert data["slug"] == "sao-paulo-station"
    assert "id" in data


async def test_list_sites(client):
    # Create two sites
    await client.post("/api/sites", json={
        "name": "Site A",
        "slug": "site-a",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    await client.post("/api/sites", json={
        "name": "Site B",
        "slug": "site-b",
        "latitude": 1.0,
        "longitude": 1.0,
    })
    response = await client.get("/api/sites")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


async def test_get_site_by_id(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Single Site",
        "slug": "single-site",
        "latitude": 10.0,
        "longitude": 20.0,
    })
    site_id = create_resp.json()["id"]

    response = await client.get(f"/api/sites/{site_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Single Site"


async def test_get_site_not_found(client):
    fake_id = uuid.uuid4()
    response = await client.get(f"/api/sites/{fake_id}")
    assert response.status_code == 404


async def test_update_site(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Old Name",
        "slug": "old-name",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    response = await client.patch(f"/api/sites/{site_id}", json={
        "name": "New Name",
        "status": "approved",
    })
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["status"] == "approved"


async def test_delete_site(client):
    create_resp = await client.post("/api/sites", json={
        "name": "To Delete",
        "slug": "to-delete",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    response = await client.delete(f"/api/sites/{site_id}")
    assert response.status_code == 204

    get_resp = await client.get(f"/api/sites/{site_id}")
    assert get_resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_sites_api.py -v
```

Expected: FAIL — 404 on all routes (no router mounted)

- [ ] **Step 3: Create site schemas**

Create `backend/app/schemas/site.py`:

```python
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.site import SiteStatus


class SiteCreate(BaseModel):
    name: str
    slug: str
    latitude: float
    longitude: float
    status: SiteStatus = SiteStatus.candidate
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    notes: Optional[str] = None


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[SiteStatus] = None
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    notes: Optional[str] = None


class SiteRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    latitude: float
    longitude: float
    status: SiteStatus
    region: Optional[str]
    country: Optional[str]
    country_code: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Create sites router**

Create `backend/app/routers/sites.py`:

```python
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.site import Site
from app.schemas.site import SiteCreate, SiteUpdate, SiteRead

router = APIRouter(prefix="/api/sites", tags=["sites"])


@router.post("", response_model=SiteRead, status_code=201)
async def create_site(body: SiteCreate, session: AsyncSession = Depends(get_session)):
    site = Site(**body.model_dump())
    session.add(site)
    await session.commit()
    await session.refresh(site)
    return site


@router.get("", response_model=list[SiteRead])
async def list_sites(session: AsyncSession = Depends(get_session)):
    result = await session.exec(select(Site))
    return result.all()


@router.get("/{site_id}", response_model=SiteRead)
async def get_site(site_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.patch("/{site_id}", response_model=SiteRead)
async def update_site(
    site_id: uuid.UUID,
    body: SiteUpdate,
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(site, key, value)
    site.updated_at = datetime.now(timezone.utc)
    session.add(site)
    await session.commit()
    await session.refresh(site)
    return site


@router.delete("/{site_id}", status_code=204)
async def delete_site(site_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    await session.delete(site)
    await session.commit()
```

- [ ] **Step 5: Mount the router in main.py**

Add to `backend/app/main.py` after the middleware block:

```python
from app.routers import sites

app.include_router(sites.router)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/test_sites_api.py -v
```

Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add Sites CRUD API with create, read, update, delete endpoints"
```

---

### Task 4: Scoring engine

**Files:**
- Create: `backend/app/services/scoring.py`
- Create: `backend/app/schemas/score.py`
- Create: `backend/app/routers/scores.py`
- Modify: `backend/app/main.py` (mount router)
- Create: `backend/tests/test_scoring.py`

- [ ] **Step 1: Write failing tests for scoring service**

Create `backend/tests/test_scoring.py`:

```python
import uuid

from app.models.site import Site, SiteStatus
from app.models.score import SiteScore, ScoreCategory
from app.services.scoring import compute_composite


async def test_compute_composite_equal_weights(session):
    site = Site(
        name="Test Site",
        slug="scoring-test",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    scores = [
        SiteScore(site_id=site.id, category=ScoreCategory.connectivity, raw_score=80, source="test"),
        SiteScore(site_id=site.id, category=ScoreCategory.environmental, raw_score=60, source="test"),
    ]
    for s in scores:
        session.add(s)
    await session.commit()

    weights = {"connectivity": 1.0, "environmental": 1.0}
    result = await compute_composite(session, site.id, weights)
    assert result["composite"] == 70.0
    assert result["scores"]["connectivity"] == 80
    assert result["scores"]["environmental"] == 60


async def test_compute_composite_weighted(session):
    site = Site(
        name="Weighted Site",
        slug="weighted-test",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    scores = [
        SiteScore(site_id=site.id, category=ScoreCategory.connectivity, raw_score=100, source="test"),
        SiteScore(site_id=site.id, category=ScoreCategory.environmental, raw_score=0, source="test"),
    ]
    for s in scores:
        session.add(s)
    await session.commit()

    # connectivity weight 3x environmental
    weights = {"connectivity": 3.0, "environmental": 1.0}
    result = await compute_composite(session, site.id, weights)
    # (100*3 + 0*1) / (3+1) = 75.0
    assert result["composite"] == 75.0


async def test_compute_composite_no_scores(session):
    site = Site(
        name="Empty Site",
        slug="empty-test",
        latitude=0.0,
        longitude=0.0,
        status=SiteStatus.candidate,
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    weights = {"connectivity": 1.0}
    result = await compute_composite(session, site.id, weights)
    assert result["composite"] is None
    assert result["scores"] == {}


async def test_score_site_endpoint(client):
    create_resp = await client.post("/api/sites", json={
        "name": "API Score Test",
        "slug": "api-score-test",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    # Add a score directly via the scores endpoint
    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "connectivity",
        "raw_score": 90,
        "data_json": {"ixp_count": 5},
        "source": "peeringdb",
    })

    # Get composite with default equal weights
    response = await client.get(f"/api/sites/{site_id}/scores")
    assert response.status_code == 200
    data = response.json()
    assert data["composite"] == 90.0
    assert data["scores"]["connectivity"] == 90


async def test_score_site_with_custom_weights(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Weight Test",
        "slug": "weight-test",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "connectivity",
        "raw_score": 100,
        "source": "test",
    })
    await client.post(f"/api/sites/{site_id}/scores", json={
        "category": "environmental",
        "raw_score": 50,
        "source": "test",
    })

    response = await client.get(
        f"/api/sites/{site_id}/scores",
        params={"weights": '{"connectivity": 2.0, "environmental": 1.0}'},
    )
    assert response.status_code == 200
    data = response.json()
    # (100*2 + 50*1) / (2+1) = 83.33
    assert round(data["composite"], 2) == 83.33
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_scoring.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scoring'`

- [ ] **Step 3: Create scoring service**

Create `backend/app/services/scoring.py`:

```python
import uuid
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.score import SiteScore


async def compute_composite(
    session: AsyncSession,
    site_id: uuid.UUID,
    weights: dict[str, float],
) -> dict[str, Any]:
    result = await session.exec(
        select(SiteScore).where(SiteScore.site_id == site_id)
    )
    site_scores = result.all()

    if not site_scores:
        return {"composite": None, "scores": {}}

    scores_by_category = {s.category.value: s.raw_score for s in site_scores}

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
    }
```

- [ ] **Step 4: Create score schemas**

Create `backend/app/schemas/score.py`:

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


class CompositeResponse(BaseModel):
    site_id: uuid.UUID
    composite: Optional[float]
    scores: dict[str, int]
```

- [ ] **Step 5: Create scores router**

Create `backend/app/routers/scores.py`:

```python
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.site import Site
from app.models.score import SiteScore
from app.schemas.score import ScoreCreate, CompositeResponse
from app.services.scoring import compute_composite

router = APIRouter(prefix="/api/sites/{site_id}/scores", tags=["scores"])

DEFAULT_WEIGHTS = {
    "connectivity": 1.0,
    "rf_satellite": 1.0,
    "infrastructure": 1.0,
    "regulatory": 1.0,
    "environmental": 1.0,
    "geopolitical": 1.0,
}


@router.post("", status_code=201)
async def add_score(
    site_id: uuid.UUID,
    body: ScoreCreate,
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    score = SiteScore(site_id=site_id, **body.model_dump())
    session.add(score)
    await session.commit()
    await session.refresh(score)
    return score


@router.get("", response_model=CompositeResponse)
async def get_scores(
    site_id: uuid.UUID,
    weights: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    site = await session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    w = json.loads(weights) if weights else DEFAULT_WEIGHTS
    result = await compute_composite(session, site_id, w)
    return CompositeResponse(site_id=site_id, **result)
```

- [ ] **Step 6: Mount the scores router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import scores

app.include_router(scores.router)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pytest tests/test_scoring.py -v
```

Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add scoring engine with weighted composite computation and API endpoints"
```

---

### Task 5: NASA POWER adapter (environmental data)

**Files:**
- Create: `backend/app/adapters/base.py`
- Create: `backend/app/adapters/nasa_power.py`
- Create: `backend/tests/test_nasa_power.py`

- [ ] **Step 1: Write failing tests for base adapter and NASA POWER**

Create `backend/tests/test_nasa_power.py`:

```python
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
        return httpx.Response(200, json=make_nasa_response())

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_nasa_power.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.adapters.base'`

- [ ] **Step 3: Create base adapter**

Create `backend/app/adapters/base.py`:

```python
from dataclasses import dataclass
from typing import Any

from app.models.score import ScoreCategory


@dataclass
class AdapterResult:
    raw_score: int
    data_json: dict[str, Any]
    source: str


class BaseAdapter:
    category: ScoreCategory

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        raise NotImplementedError
```

- [ ] **Step 4: Create NASA POWER adapter**

Create `backend/app/adapters/nasa_power.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_nasa_power.py -v
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add base adapter interface and NASA POWER environmental adapter"
```

---

### Task 6: PeeringDB adapter (connectivity data)

**Files:**
- Create: `backend/app/adapters/peeringdb.py`
- Create: `backend/tests/test_peeringdb.py`

- [ ] **Step 1: Write failing tests for PeeringDB adapter**

Create `backend/tests/test_peeringdb.py`:

```python
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
        return httpx.Response(200, json=make_peeringdb_response())

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
        return httpx.Response(200, json=make_peeringdb_response())

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
        return httpx.Response(200, json={"data": []})

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    result = await adapter.fetch(latitude=0.0, longitude=0.0)
    assert result.data_json["ixp_count_100km"] == 0
    assert result.data_json["nearest_ixp_km"] is None
    assert result.raw_score <= 10
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_peeringdb.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.adapters.peeringdb'`

- [ ] **Step 3: Create PeeringDB adapter**

Create `backend/app/adapters/peeringdb.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_peeringdb.py -v
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add PeeringDB connectivity adapter with IXP proximity scoring"
```

---

### Task 7: Auth service and endpoints

**Files:**
- Create: `backend/app/models/user.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/services/auth.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py` (mount router)
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing tests for auth**

Create `backend/tests/test_auth.py`:

```python
from app.services.auth import hash_password, verify_password, create_access_token, decode_token


async def test_password_hashing():
    password = "securepassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


async def test_jwt_token_roundtrip():
    token = create_access_token({"sub": "user@example.com", "role": "internal"})
    payload = decode_token(token)
    assert payload["sub"] == "user@example.com"
    assert payload["role"] == "internal"


async def test_register_and_login(client):
    # Register
    response = await client.post("/api/auth/register", json={
        "email": "admin@satport.com",
        "password": "securepass123",
        "role": "internal",
    })
    assert response.status_code == 201
    assert response.json()["email"] == "admin@satport.com"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()

    # Login
    response = await client.post("/api/auth/login", json={
        "email": "admin@satport.com",
        "password": "securepass123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client):
    await client.post("/api/auth/register", json={
        "email": "user@test.com",
        "password": "correctpassword",
        "role": "internal",
    })
    response = await client.post("/api/auth/login", json={
        "email": "user@test.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_nonexistent_user(client):
    response = await client.post("/api/auth/login", json={
        "email": "nobody@test.com",
        "password": "anything",
    })
    assert response.status_code == 401


async def test_me_endpoint(client):
    await client.post("/api/auth/register", json={
        "email": "me@test.com",
        "password": "mypassword",
        "role": "internal",
    })
    login_resp = await client.post("/api/auth/login", json={
        "email": "me@test.com",
        "password": "mypassword",
    })
    token = login_resp.json()["access_token"]

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "me@test.com"
    assert response.json()["role"] == "internal"


async def test_me_endpoint_no_token(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_auth.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.auth'`

- [ ] **Step 3: Create User model**

Create `backend/app/models/user.py`:

```python
import enum
import uuid
from typing import Optional

from sqlmodel import Field, SQLModel


class UserRole(str, enum.Enum):
    internal = "internal"
    customer = "customer"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: UserRole = Field(default=UserRole.internal)
    customer_id: Optional[uuid.UUID] = Field(default=None, foreign_key="customers.id")


class Customer(SQLModel, table=True):
    __tablename__ = "customers"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
```

- [ ] **Step 4: Update models __init__.py**

Update `backend/app/models/__init__.py`:

```python
from app.models.site import Site, SiteStatus
from app.models.score import SiteScore, ScoreCategory
from app.models.profile import ScoreProfile, OwnerType
from app.models.user import User, UserRole, Customer

__all__ = [
    "Site",
    "SiteStatus",
    "SiteScore",
    "ScoreCategory",
    "ScoreProfile",
    "OwnerType",
    "User",
    "UserRole",
    "Customer",
]
```

- [ ] **Step 5: Create auth service**

Create `backend/app/services/auth.py`:

```python
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return {}
```

- [ ] **Step 6: Create auth schemas**

Create `backend/app/schemas/auth.py`:

```python
import uuid
from typing import Optional

from pydantic import BaseModel

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.internal


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    customer_id: Optional[uuid.UUID]
```

- [ ] **Step 7: Create auth router**

Create `backend/app/routers/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserRead
from app.services.auth import hash_password, verify_password, create_access_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


@router.post("/register", response_model=UserRead, status_code=201)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.exec(select(User).where(User.email == body.email))
    user = result.first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.email, "role": user.role.value})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
async def me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
):
    payload = decode_token(credentials.credentials)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await session.exec(select(User).where(User.email == email))
    user = result.first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

- [ ] **Step 8: Mount the auth router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import auth

app.include_router(auth.router)
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pytest tests/test_auth.py -v
```

Expected: PASS (7 tests)

- [ ] **Step 10: Run ALL tests**

```bash
pytest -v
```

Expected: PASS — all tests across all files (health, models, sites API, scoring, NASA POWER, PeeringDB, auth)

- [ ] **Step 11: Commit**

```bash
cd C:\SatportProjects\SiteSearch
git add backend/
git commit -m "feat: add JWT auth with register, login, and current user endpoints"
```

---

## Summary

After completing all 7 tasks, the backend will have:

| Component | What it does |
|-----------|-------------|
| FastAPI app | Health check, CORS, auto-created tables |
| Site model + CRUD API | Create, list, get, update, delete ground station sites |
| SiteScore model | Per-category scores (0-100) with JSONB data |
| ScoreProfile model | Saved weight configurations |
| Scoring engine | Weighted composite computation at query time |
| NASA POWER adapter | Environmental scoring (temp, precip, solar, wind) |
| PeeringDB adapter | Connectivity scoring (IXP proximity and count) |
| JWT auth | Register, login, token-protected `/me` endpoint |
| Test suite | Full coverage with async test DB |

**Deferred to future plans:** NLP search (pgvector), structured search parser, data ingestion scheduler, export (CSV/GeoJSON/PDF), frontend API wiring, customer multi-tenancy v2.
