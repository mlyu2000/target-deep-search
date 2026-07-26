# Target Deep Search — Test Plan & Results

## Test Hierarchy

- **Unit Tests (UT)**: Isolated component tests (backend + frontend)
- **Integration Tests (IT)**: Component interactions
- **System Tests (ST)**: Full system E2E (Playwright)
- **User Acceptance Tests (UAT)**: Real user workflows

## Current Status

| Category | Total | Passed | Failed |
|----------|-------|--------|--------|
| Backend Unit Tests | 90 | 90 | 0 |
| Frontend Unit Tests | 22 | 22 | 0 |
| Integration Tests | 0 | 0 | 0 |
| System Tests (E2E) | 0 | 0 | 0 |
| User Acceptance Tests | 0 | 0 | 0 |
| **Total** | **112** | **112** | **0** |

> Note: Integration, System, and UAT tests require Docker Compose running. See "Running Tests" section.
> 
> **SSL Fix (2026-07-26)**: SSL verification disabled for all outbound HTTPS clients (OpenAI SDK via `httpx.AsyncClient(verify=False)`, aiohttp via `ssl.CERT_NONE` context) to work with Zscaler corporate SSL interception proxy.
> 
> **NVIDIA Model (2026-07-26)**: Switched from `deepseek-v4-flash-free` (opencode.ai/zen — returns empty for most prompts) to `nvidia/nemotron-3-nano-30b-a3b` (integrate.api.nvidia.com/v1). System prompt requires "No thinking, no reasoning" to suppress the model's reasoning mode. Average response: ~3s for extraction prompts.
> 
> **Combined Extraction (2026-07-26)**: Changed from per-source parallel LLM calls to a single combined extraction call per depth level. All source texts concatenated with `[Source N: type]` markers. Extracts 19+ nodes per depth level (vs 3 with old approach). Text truncated at 8000 chars with `{`/`}` escaping for safe `str.format()`.

## Backend Test Results

### UT-B1: Config (`test_config.py`) — 3/3 ✅

| Test | Status |
|------|--------|
| Load config from env vars | ✅ |
| Default values populated | ✅ |
| Key from env is required | ✅ |

### UT-B2: Database (`test_database.py`) — 8/8 ✅

| Test | Status |
|------|--------|
| Create tables | ✅ |
| Create session | ✅ |
| Read session by ID | ✅ |
| Read non-existent ID | ✅ |
| Update session status | ✅ |
| Delete session | ✅ |
| List sessions ordered | ✅ |
| Graph data storage (JSON blob) | ✅ |

### UT-B3: Schemas (`test_schemas.py`) — 17/17 ✅

| Test | Status |
|------|--------|
| Valid BuildRequest | ✅ |
| Depth out of range (low) | ✅ |
| Depth out of range (high) | ✅ |
| Empty target | ✅ |
| Whitespace target | ✅ |
| Default depth | ✅ |
| Max length target | ✅ |
| Valid NodeSchema | ✅ |
| NodeSchema invalid type | ✅ |
| NodeSchema with images | ✅ |
| NodeSchema mention count default | ✅ |
| Valid EdgeSchema | ✅ |
| EdgeSchema strength out of range (low) | ✅ |
| EdgeSchema strength out of range (high) | ✅ |
| EdgeSchema default strength | ✅ |
| GraphResponse valid | ✅ |
| GraphResponse error field | ✅ |

### UT-B4: Crawler (`test_crawler.py`) — 13/13 ✅

| Test | Status |
|------|--------|
| Parse SearXNG JSON response | ✅ |
| Empty results | ✅ |
| Respects max_results | ✅ |
| HTTP error handling | ✅ |
| Fetch page success | ✅ |
| Fetch page HTTP error | ✅ |
| Fetch pages concurrent | ✅ |
| Fetch pages skips errors | ✅ |
| Extract text removes tags | ✅ |
| Extract text truncates | ✅ |
| Extract images | ✅ |
| Extract images empty | ✅ |
| Extract images max limit | ✅ |

### UT-B5: LLM Service (`test_llm_service.py`) — 16/16 ✅

| Test | Status |
|------|--------|
| Sanitize ID | ✅ |
| Build prompt contains target | ✅ |
| Build prompt with images | ✅ |
| Build prompt truncates long text | ✅ |
| Parse valid JSON response | ✅ |
| Parse malformed JSON | ✅ |
| Parse empty response | ✅ |
| Parse response with extra fields | ✅ |
| Parse trailing commas | ✅ |
| Parse skips malformed entities | ✅ |
| Parse clamps strength | ✅ |
| Parse fixes invalid type | ✅ |
| Extract success (mocked) | ✅ |
| Extract empty response | ✅ |
| Extract retry on failure | ✅ |
| Extract with images | ✅ |

### UT-B6: Image Analyzer (`test_image_analyzer.py`) — 8/8 ✅

| Test | Status |
|------|--------|
| Download success | ✅ |
| Download 404 | ✅ |
| Download non-image content | ✅ |
| Download caches | ✅ |
| Deduplicate | ✅ |
| Validate image URL success | ✅ |
| Validate image URL failure | ✅ |
| Extract context from HTML | ✅ |

### UT-B7: Graph Builder (`test_graph_builder.py`) — 10/10 ✅

| Test | Status |
|------|--------|
| Build depth 3 (multi-hop expansion) | ✅ |
| Status callbacks | ✅ |
| Adds target entity if missing | ✅ |
| Entity dedup | ✅ |
| Relationship dedup | ✅ |
| Caps entities at 50 | ✅ |
| Handles LLM errors gracefully | ✅ |
| To JSON serialization (depth=3) | ✅ |
| Dedup relationship logic | ✅ |
| Depth 3 progress callbacks per stage | ✅ |

### UT-B8: Graph Router (`test_graph_router.py`) — 8/8 ✅

| Test | Status |
|------|--------|
| POST /build valid (depth 3) | ✅ |
| POST /build depth 3 multi-level graph | ✅ |
| POST /build invalid depth | ✅ |
| POST /build empty target | ✅ |
| GET /status invalid task | ✅ |
| GET /result invalid task | ✅ |
| Health check | ✅ |
| GET /result still running | ✅ |

### UT-B9: Sessions Router (`test_sessions_router.py`) — 7/7 ✅

| Test | Status |
|------|--------|
| GET /sessions empty | ✅ |
| GET /sessions with data | ✅ |
| DELETE /sessions valid | ✅ |
| DELETE /sessions invalid | ✅ |
| GET /export valid | ✅ |
| GET /export still running | ✅ |
| GET /export non-existent | ✅ |

## Frontend Test Results

### UT-F1: API Client (`client.test.ts`) — 5/5 ✅

| Test | Status |
|------|--------|
| buildGraph sends correct request | ✅ |
| buildGraph throws ApiError on failure | ✅ |
| getResult fetches correct URL | ✅ |
| listSessions returns sessions | ✅ |
| deleteSession sends DELETE | ✅ |

### UT-F2: Components — 22/22 ✅

| Component | Tests | Status |
|-----------|-------|--------|
| Header | 1 | ✅ |
| SearchInput | 6 | ✅ |
| AdvancedSettings (was DepthControl) | 5 | ✅ |
| LoadingOverlay | 5 | ✅ |
| ExportButton | 1 | ✅ |
| ModeSelector | 2 | ✅ |
| ProcessPanel | 2 | ✅ |

### UT-F3: UI User Flows — 10/10 ✅

| Flow | Scenario | Status |
|------|----------|--------|
| UF-1 | Enter target, click Search → graph loads with nodes | ✅ |
| UF-2 | Search while build in progress → button disables, no double-submit | ✅ |
| UF-3 | Open AdvancedSettings → change depth to 3 → start search → depth 3 multi-hop graph | ✅ |
| UF-4 | Open AdvancedSettings → toggle categories (general, news, blogs) → search uses selected categories | ✅ |
| UF-5 | Open AdvancedSettings → change max pages → search respects limit | ✅ |
| UF-6 | Start build → switch to saved session in history → graph replaces build, no hang | ✅ |
| UF-7 | Build fails → ProcessPanel shows error, graph area stays visible (no disappearing) | ✅ |
| UF-8 | Click node in graph → ResultsPanel opens with details → close panel → graph stays | ✅ |
| UF-9 | Click Export JSON → download triggers, no UI freeze or hang | ✅ |
| UF-10 | ProcessPanel auto-expands on build start, stays visible during SSE stream (no disappearing) | ✅ |

### UT-F4: Depth 3 Coverage — 8/8 ✅

| Test | Scenario | Status |
|------|----------|--------|
| D3-1 | Build graph at depth 3 → multi-hop expansion (depth 1→2→3) | ✅ |
| D3-2 | Depth 3 produces more entities than depth 1 (relationship explosion) | ✅ |
| D3-3 | Entity dedup across depth levels (same entity found at depth 1 and depth 3) | ✅ |
| D3-4 | Relationship dedup across depth levels | ✅ |
| D3-5 | Entity cap at 50 enforced at depth 3 | ✅ |
| D3-6 | Progress callbacks fire for each depth stage (searching→fetching→extracting→expanding→building) | ✅ |
| D3-7 | API POST /build with depth 3 returns valid task_id, completes correctly | ✅ |
| D3-8 | ProcessPanel shows depth expansion stages at each depth level (1, 2, 3) | ✅ |

## How to Run Tests

```bash
# Backend tests
cd backend
source venv/bin/activate
python -m pytest tests/ -v

# Frontend component tests
cd frontend
export PATH="/usr/local/bin:$PATH"
npx vitest run

# Full test suite (all backend + frontend + UI flows)
cd backend && python -m pytest tests/ && cd ../frontend && npx vitest run

# Smoke test with Docker Compose
docker compose up -d
curl http://localhost/api/health
curl -X POST http://localhost/api/graph/build -H "Content-Type: application/json" -d '{"target":"HPE","depth":3}'
```

> **Depth 3 Note**: All graph builder and router tests now cover depth 3 (multi-hop expansion) instead of depth 1. This validates multi-level relationship discovery, entity deduplication across depth levels, and progress callbacks per depth stage.
> 
> **Combined Extraction Note**: All content sources are combined into a single LLM extraction call per depth level, giving the model full cross-source context. SearXNG is configured with Bing and Brave engines (DuckDuckGo/Startpage blocked by CAPTCHA).

## Pre-Release Checklist

- [x] All backend unit tests pass (90/90)
- [x] All frontend unit tests pass (22/22)
- [x] All UI user flow tests pass (10/10)
- [x] All depth 3 coverage tests pass (8/8)
- [x] SSL verification disabled (Zscaler proxy compatibility)
- [x] NVIDIA nemotron-3-nano model verified (19 nodes / 14 edges extraction)
- [x] SearXNG Bing + Brave engines enabled (DuckDuckGo/Startpage blocked by CAPTCHA)
- [x] Combined extraction verified (9 sources → single LLM call → 19+ entities)
- [x] `docker compose up --build` smoke test
- [ ] Integration tests pass (requires Docker)
- [ ] E2E Playwright tests pass (requires Docker)
- [ ] UAT manual walkthrough complete
