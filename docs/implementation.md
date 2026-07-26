# Target Deep Search — Implementation Tracking

## Phase Status

| # | Phase | Status | Tests |
|---|-------|--------|-------|
| 0 | Project scaffolding | **completed** | — |
| 1 | Docker infrastructure | **completed** | — |
| 2 | Backend core (config, DB, models, schemas, main) | **completed** | 28 |
| 3 | LLM integration service | **completed** | 16 |
| 4 | Crawler & image analyzer | **completed** | 21 |
| 5 | Graph builder orchestrator | **completed** | 9 |
| 6 | API routers (graph + sessions) | **completed** | 14 |
| 7 | Frontend scaffold (Vite, React, theme, API client) | **completed** | 5 |
| 8 | Frontend controls (Header, Search, Depth, Loading, Export, Sessions) | **completed** | 17 |
| 9 | GraphViewer (D3 force-directed graph) | **completed** | — |
| 10 | ResultsPanel (entity details sidebar) | **completed** | — |
| 11 | Living documents & README | **completed** | — |

## File-Level Tracking

### Backend Files

| File | Phase | Status | Notes |
|------|-------|--------|-------|
| `app/__init__.py` | 0 | done | |
| `app/config.py` | 2 | done | Pydantic Settings with env vars |
| `app/database.py` | 2 | done | Async SQLAlchemy engine |
| `app/models.py` | 2 | done | Session ORM with JSON blob |
| `app/schemas.py` | 2 | done | BuildRequest, GraphResponse, Node, Edge, Image |
| `app/main.py` | 2 | done | FastAPI app with CORS + lifespan |
| `app/llm_service.py` | 3 | done | OpenAI client + prompt + JSON parser |
| `app/crawler.py` | 4 | done | SearXNG + aiohttp + BeautifulSoup |
| `app/image_analyzer.py` | 4 | done | Download, cache, dedup, validate |
| `app/graph_builder.py` | 5 | done | Orchestrator with depth expansion |
| `routers/graph.py` | 6 | done | SSE streaming + background tasks |
| `routers/sessions.py` | 6 | done | CRUD + JSON export |

### Frontend Files

| File | Phase | Status | Notes |
|------|-------|--------|-------|
| `src/main.tsx` | 7 | done | React entry point |
| `src/App.tsx` | 7 | done | App state + layout |
| `src/types.ts` | 7 | done | TypeScript interfaces |
| `api/client.ts` | 7 | done | Fetch + SSE wrappers |
| `styles/theme.css` | 7 | done | HPE CSS variables |
| `styles/global.css` | 7 | done | Reset, typography, utilities |
| `components/Header.tsx` | 8 | done | Dark navy bar |
| `components/SearchInput.tsx` | 8 | done | Input + search button |
| `components/DepthControl.tsx` | 8 | done | Slider 1-4 |
| `components/GraphViewer.tsx` | 9 | done | D3.js force-directed graph |
| `components/ResultsPanel.tsx` | 10 | done | Entity details sidebar |
| `components/LoadingOverlay.tsx` | 8 | done | Progress + error states |
| `components/ExportButton.tsx` | 8 | done | JSON download |
| `components/SessionList.tsx` | 8 | done | Saved sessions |

## Known Issues / Technical Debt

- GraphBuilder unit tests use mocks for crawler/LLM — integration tests with real SearXNG would be valuable
- Image analysis is metadata-only (no vision LLM integration in MVP)
- No user authentication (single-user desktop app)
- Frontend GraphViewer component has no unit tests (D3 can't be properly tested in jsdom)
