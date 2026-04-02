# SiteSearch - Clean Machine Setup Guide

## Prerequisites

### 1. Install Git
- Go to https://git-scm.com/download/win
- Download and run the installer
- Use all default options, click Next through everything, then Install

### 2. Install Node.js
- Go to https://nodejs.org
- Download the **LTS** version (v22)
- Run the installer, use all defaults

### 3. Install Miniconda
- Go to https://docs.conda.io/en/latest/miniconda.html
- Download **Miniconda3 Windows 64-bit**
- Run the installer
- **Important:** Check the box "Add Miniconda3 to my PATH environment variable" during installation
- If you skip this, conda will only work from the "Anaconda Prompt" (search for it in the Start Menu)

### 4. Install PostgreSQL + PostGIS
- Go to https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- Download the latest version (PostgreSQL 17 or newer) for Windows
- Run the installer:
  - Set a password for the `postgres` user — **remember this password!**
  - Keep the default port **5432**
  - When it asks to launch **Stack Builder** at the end, say **Yes**
- In Stack Builder:
  - Select your PostgreSQL installation
  - Under **Spatial Extensions**, check **PostGIS** (latest version)
  - Click Next and install it

### 5. Add PostgreSQL to your PATH
PostgreSQL does not add itself to PATH by default, so `psql` won't be recognized in your terminal.
- Press **Win + R**, type `sysdm.cpl`, press Enter
- Go to the **Advanced** tab, click **Environment Variables**
- Under **System variables**, find **Path**, click **Edit**
- Click **New** and add the path to your PostgreSQL bin folder, e.g. `C:\Program Files\PostgreSQL\17\bin`
- Click OK on all dialogs

### 6. Restart your computer
This ensures Git, Node, Conda, and PostgreSQL are all available in your terminal.

---

## Project Setup

### 7. Create the project folder and clone the repo
Open a terminal and run these one at a time:
```
mkdir C:\SatportProjects
cd C:\SatportProjects
git clone https://github.com/jagus26/SatPortSiteSearch.git SiteSearch
cd SiteSearch
```

### 8. Install frontend dependencies
```
npm install
```

### 9. Verify the frontend works
```
npm run test:run
```
You should see 12 tests passing.

---

## Database Setup

### 10. Create the project database
Open your terminal (or Anaconda Prompt) and run:
```
psql -U postgres
```
Enter the password you set during PostgreSQL installation, then run:
```sql
CREATE DATABASE sitesearch;
\c sitesearch
CREATE EXTENSION postgis;
\q
```
**Note:** pgvector (`CREATE EXTENSION vector`) is needed for NLP search but is not bundled with PostgreSQL on Windows. It will be installed separately when needed (post-v1).

---

## Python Backend Setup

### 11. Create the Python environment
If conda is not recognized, use the "Anaconda Prompt" from the Start Menu instead.
```
conda create -n sitesearch python=3.12 -y
conda activate sitesearch
```

### 12. Install Python packages
```
pip install fastapi uvicorn[standard] sqlmodel httpx pydantic-settings
pip install psycopg[binary] asyncpg
pip install pytest pytest-asyncio pytest-cov
```

### 13. Verify everything works
```
python --version
python -c "import fastapi; print(fastapi.__version__)"
python -c "import asyncpg; print('asyncpg OK')"
```

---

## Quick Reference

| Tool | Version | Purpose |
|------|---------|---------|
| Git | latest | Version control |
| Node.js | v22 LTS | Frontend build/dev |
| Python | 3.12 | Backend API |
| PostgreSQL | 17+ | Database |
| PostGIS | 3.6+ | Spatial queries (geometry, radius search) |
| pgvector | latest | Embedding similarity search (NLP search) |
| FastAPI | latest | API framework |
| SQLModel | latest | ORM (SQLAlchemy + Pydantic) |
| psycopg | latest | PostgreSQL driver (sync) |
| asyncpg | latest | PostgreSQL driver (async) |
| httpx | latest | HTTP client for external APIs (NASA POWER, PeeringDB) |
| Vitest | latest | Frontend tests |
| pytest | latest | Backend tests |
