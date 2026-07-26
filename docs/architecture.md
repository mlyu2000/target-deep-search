# Target Deep Search — Architecture Document

## Overview

Web app that crawls the internet for a user-specified target entity, uses LLM to extract entities/relationships, and renders an interactive D3.js relationship graph. User controls crawl depth (1–4).

## System Architecture

```
Frontend (React + D3) ──HTTP──> Backend (FastAPI) ──> SearXNG (Docker)
                                        │
                                        └──> LLM API (opencode.ai/zen)
                                               Model: deepseek-v4-flash-free
```

## Services

| Service | Port | Tech |
|---------|------|------|
| `frontend` | 3000 | React 18 + Vite + D3.js + TypeScript |
| `backend` | 8000 | Python 3.12 + FastAPI + SQLAlchemy + aiohttp |
| `searxng` | 8080 (internal) | SearXNG meta-search engine |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/graph/build` | Start async graph build |
| GET | `/api/graph/status/{id}` | SSE status stream |
| GET | `/api/graph/result/{id}` | Get graph result |
| GET | `/api/sessions` | List saved sessions |
| DELETE | `/api/sessions/{id}` | Delete session |
| GET | `/api/sessions/{id}/export` | Download graph JSON |

## Database

Single SQLite table `sessions`: `{id, target, depth, status, error_msg, created_at, updated_at, graph_data (JSON blob)}`

## Key Design Decisions

- **Single JSON blob** for graph data: simpler than relational node/edge tables for MVP
- **SSE streaming**: real-time status updates during long-running graph builds
- **Async parallel crawling**: `asyncio.Semaphore(5)` limits concurrent HTTP fetches
- **HPE Design System**: colors derived from `design-system.hpe.design`
- **Image analysis**: images are collected as metadata; LLM vision support is optional

## Color System (HPE-Inspired)

| Token | Hex | Usage |
|-------|-----|-------|
| `--hpe-brand` | `#01a982` | Primary accent, buttons |
| `--hpe-dark` | `#1d1f27` | Header, hero background |
| `--hpe-light` | `#f7f7f7` | Page background |
| `--hpe-white` | `#ffffff` | Card surfaces |

## File Inventory (as-built)

```
target-deep-search/
├── docker-compose.yml            # 3 services: searxng, backend, frontend
├── .gitignore
├── .env.example
├── searxng/
│   └── settings.yml              # SearXNG config with JSON API
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env                      # API keys (gitignored)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app + CORS + lifespan
│   │   ├── config.py             # Pydantic Settings
│   │   ├── database.py           # SQLAlchemy async engine
│   │   ├── models.py             # Session ORM
│   │   ├── schemas.py            # Request/response models
│   │   ├── crawler.py            # SearXNG search + page fetch + image extraction
│   │   ├── llm_service.py        # OpenAI client + prompt + JSON parser
│   │   ├── image_analyzer.py     # Image download + dedup + validation
│   │   ├── graph_builder.py      # Orchestrator: crawl → extract → merge
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── graph.py          # Build + SSE status + result endpoints
│   │       └── sessions.py       # Session CRUD + export
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py           # Shared fixtures
│       ├── test_config.py        # 3 tests
│       ├── test_database.py      # 9 tests
│       ├── test_schemas.py       # 12 tests
│       ├── test_crawler.py       # 13 tests
│       ├── test_image_analyzer.py # 8 tests
│       ├── test_llm_service.py   # 16 tests
│       ├── test_graph_builder.py # 9 tests
│       ├── test_graph_router.py  # 7 tests
│       └── test_sessions_router.py # 7 tests
├── frontend/
│   ├── Dockerfile                # Multi-stage: node build → nginx serve
│   ├── nginx.conf                # Proxy /api/ to backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               # Main app state + layout
│       ├── types.ts              # TypeScript interfaces
│       ├── api/
│       │   └── client.ts         # API client + SSE connection
│       ├── styles/
│       │   ├── theme.css         # HPE CSS variables
│       │   └── global.css        # Reset + base styles
│       ├── components/
│       │   ├── Header.tsx + .css
│       │   ├── SearchInput.tsx + .css
│       │   ├── DepthControl.tsx + .css
│       │   ├── GraphViewer.tsx + .css  # D3 force-directed graph
│       │   ├── ResultsPanel.tsx + .css # Entity details sidebar
│       │   ├── LoadingOverlay.tsx + .css
│       │   ├── ExportButton.tsx + .css
│       │   └── SessionList.tsx + .css
│       └── tests/
│           ├── setup.ts
│           ├── api/client.test.ts       # 5 tests
│           └── components/
│               ├── Header.test.tsx      # 1 test
│               ├── SearchInput.test.tsx  # 6 tests
│               ├── DepthControl.test.tsx # 4 tests
│               ├── LoadingOverlay.test.tsx # 5 tests
│               └── ExportButton.test.tsx # 1 test
└── docs/
    ├── architecture.md            # This file
    ├── implementation.md          # Phase tracking
    └── test-plan.md               # Test results
```

## Total Tests: 110 (88 backend + 22 frontend)
