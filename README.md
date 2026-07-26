# Target Deep Search

Crawl the internet for a target entity and visualize its relationship graph using LLM-powered extraction.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- An OpenAI-compatible API key (set in `backend/.env`)

### Setup

```bash
# 1. Configure API key
cp .env.example backend/.env
# Edit backend/.env and set OPENAI_API_KEY

# 2. Start all services
docker compose up --build

# 3. Open browser
open http://localhost:3000
```

### Usage

1. Enter a target (person, company, or concept)
2. Select search depth (1-4)
3. Click **Search**
4. Wait for the graph to build
5. Click nodes to explore connections
6. Export as JSON or save for later

## Architecture

```
Frontend (React + D3.js) ──► Backend (FastAPI) ──► SearXNG (search)
                                    │
                                    └──► LLM API (entity extraction)
```

- **Frontend**: React 18 + Vite + D3.js force-directed graph
- **Backend**: Python FastAPI + SQLAlchemy + aiohttp + OpenAI SDK
- **Search**: SearXNG (self-hosted, runs in Docker)
- **LLM**: OpenAI-compatible API (opencode.ai/zen, model: deepseek-v4-flash-free)

## Tests

```bash
# Backend (88 tests)
cd backend && source venv/bin/activate && python -m pytest tests/ -v

# Frontend (22 tests)
cd frontend && npx vitest run
```

See `docs/` for architecture, implementation tracking, and test plan.
