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

## Key Changes (2026-07-26)

| Change | Before | After |
|--------|--------|-------|
| LLM endpoint | `opencode.ai/zen/v1` | `integrate.api.nvidia.com/v1` |
| LLM model | `deepseek-v4-flash-free` (unreliable) | `nvidia/nemotron-3-nano-30b-a3b` (~3s response) |
| Extraction approach | Per-source parallel LLM calls | Single combined extraction per depth level |
| Extraction prompt rule 5 | "Minimum 2 entities" | "Aim for at least 10 entities" |
| Text truncation | 15000 chars | 8000 chars |
| Crawler timeout | 10s | 30s |
| LLM timeout | 120s | 180s |
| SearXNG engines | Wikipedia only (DDG/Startpage blocked) | Bing + Brave + Wikipedia |
| System prompt | "Always respond with valid JSON only" | + "No thinking, no reasoning" |
| `_parse_response` format | Fixed `entities`/`relationships` object | Handles arrays, `nodes`/`edges` keys, `subject`/`object`/`predicate` fields, NER types (ORG/PERSON/LOC) |
| `_parse_response` fallback | Trailing comma cleanup only | Progressive trim + `raw_decode` fallback |
| Curly-brace handling | None (crashed on page text with `{}`) | `{`→`{{`, `}`→`}}` before `str.format()` |
| Background generation | Yes | Removed (model returns empty for prose) |
| Backend tests | 91 | 90 (2 updated for new defaults + parser) |
| Frontend bugs | SSE leaks, session load, build log entries | Fixed stale connection cleanup, proper refresh, descriptive entries |

## Known Issues / Technical Debt

- **Model reliability**: NVIDIA nemotron-3-nano occasionally ignores the "No thinking" instruction and outputs reasoning text instead of JSON (~1/3 of large prompts). Retry logic handles this with text shortening.
- GraphBuilder unit tests use mocks for crawler/LLM — integration tests with real SearXNG would be valuable
- Image analysis is metadata-only (no vision LLM integration in MVP)
- No user authentication (single-user desktop app)
- Frontend GraphViewer component has no unit tests (D3 can't be properly tested in jsdom)
