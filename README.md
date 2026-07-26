# Target Deep Search

Crawl the internet for a target entity and visualize its relationship graph using LLM-powered extraction.

## Quick Start — Local (self-contained, no external keys)

This repo is verified working against a **local SearXNG** (`localhost:8888`, container
`searxng-core`) and a **local OpenAI-compatible LLM** (`localhost:9000`, e.g. vLLM serving
`qwen3.5-4b`). The config defaults in `backend/app/config.py` and `backend/.env` already
point at these endpoints.

```bash
# 1. Install backend deps (Python 3.11 venv)
cd backend && python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Ensure SearXNG + LLM are reachable
curl -s "http://localhost:8888/search?q=test&format=json" -o /dev/null -w "searxng %{http_code}\n"
curl -s "http://localhost:9000/v1/models" -o /dev/null -w "llm %{http_code}\n"

# 3. Run a build (graph / competitive / supplychain)
python run_demo.py --target "Hewlett Packard Enterprise" --mode competitive --depth 2
# -> writes results/<target>_<mode>_d<depth>_<ts>.json + .html

# 4. (Optional) Run the API server + frontend
uvicorn app.main:app --host 0.0.0.0 --port 8000
# frontend: build with `npm run build` and serve dist/ (see frontend/)
```

### Prerequisites (Docker path)

- Docker & Docker Compose (note: `docker-compose.yml` expects `backend/.env.docker`,
  which is **not** in the repo — create it or run the backend natively as above)
- An OpenAI-compatible API key (set in `backend/.env`)

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
