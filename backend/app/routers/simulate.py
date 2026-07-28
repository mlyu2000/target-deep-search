"""What-if simulation API.

Mirrors the graph build/status/result SSE pattern but is ephemeral (no DB row).
Flow:
  POST /api/simulate  -> { task_id }            (starts background sim)
  GET  /api/simulate/status/{task_id} -> SSE     (progress)
  GET  /api/simulate/result/{task_id} -> result  (final SimulationResult)
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.crawler import Crawler
from app.llm_service import LLMService
from app.simulation.engine import SimulationResult, run_simulation
from app.simulation.persona import build_personas
from app.simulation.history import save_run, list_runs, get_run, delete_run

logger = logging.getLogger(__name__)

router = APIRouter(tags=["simulate"])

status_queues: dict[str, asyncio.Queue] = {}
results_cache: dict[str, SimulationResult] = {}


class SimulateRequest(BaseModel):
    graph: dict[str, Any]
    scenario: str
    top_k: int = 6
    rounds: int = 3
    until_stable: bool = False
    enrich: bool = True


@router.post("/simulate")
async def start_simulate(req: SimulateRequest):
    if not req.scenario or not req.scenario.strip():
        raise HTTPException(status_code=400, detail="scenario is required")
    if not req.graph or not req.graph.get("nodes"):
        raise HTTPException(status_code=400, detail="graph is required")

    task_id = str(uuid.uuid4())
    status_queues[task_id] = asyncio.Queue()
    asyncio.create_task(_run_simulate(task_id, req))
    return {"task_id": task_id}


async def _run_simulate(task_id: str, req: SimulateRequest):
    queue = status_queues.get(task_id)

    async def emit(status: str, message: str, round_num: int = 0, **kwargs):
        if queue:
            await queue.put({"status": status, "message": message, "round": round_num, **kwargs})

    try:
        llm = LLMService()
        crawler = Crawler()
        await emit("simulating", "Selecting top agents from graph...", 0)
        personas = await build_personas(
            req.graph, llm, top_k=req.top_k, enrich=req.enrich, crawler=crawler, emit=emit
        )
        if not personas:
            await emit("error", "No agents could be built from the graph")
            return
        result = await run_simulation(
            personas, req.scenario, llm, rounds=req.rounds,
            until_stable=req.until_stable, emit=emit,
            target=req.graph.get("target", ""), graph=req.graph,
        )
        results_cache[task_id] = result
        # Persist to saved-runs history for business review / compare.
        try:
            enriched = sum(1 for a in result.agents if a.get("enriched"))
            save_run(
                target=req.graph.get("target", ""),
                scenario=req.scenario,
                rounds=len(result.rounds),
                graph_depth=req.graph.get("depth", 0),
                agents_count=len(result.agents),
                enriched_count=enriched,
                result=result.to_dict(),
            )
        except Exception as e:  # history is best-effort; never break the run
            logger.warning("Failed to save sim run to history: %s", e)
        await emit("complete", f"Simulation complete: {len(result.rounds)} rounds, {len(personas)} agents")
    except Exception as e:
        logger.exception("Simulation failed")
        await emit("error", f"Simulation failed: {str(e)}")
    finally:
        if queue:
            await queue.put(None)


@router.get("/simulate/status/{task_id}")
async def stream_status(task_id: str):
    queue = status_queues.get(task_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        while True:
            update = await queue.get()
            if update is None:
                break
            yield {"event": "status", "data": json.dumps(update, default=str)}

    return EventSourceResponse(event_generator())


@router.get("/simulate/result/{task_id}")
async def get_result(task_id: str):
    if task_id in results_cache:
        return results_cache[task_id].to_dict()
    if task_id not in status_queues:
        raise HTTPException(status_code=404, detail="Task not found")
    raise HTTPException(status_code=409, detail="Simulation still running")


@router.get("/simulate/runs")
async def list_saved_runs():
    return {"runs": list_runs()}


@router.get("/simulate/runs/{run_id}")
async def get_saved_run(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Saved run not found")
    return run


@router.delete("/simulate/runs/{run_id}")
async def delete_saved_run(run_id: str):
    if delete_run(run_id):
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Saved run not found")


@router.get("/simulate/runs/{run_id}/export")
async def export_saved_run(run_id: str, format: str = "markdown"):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Saved run not found")
    r = run.get("result", {}).get("report", {})
    lines = []
    lines.append(f"# What-if Strategy Memo — {run.get('target', '')}")
    lines.append("")
    lines.append(f"**Scenario:** {run.get('scenario', '')}")
    lines.append(f"**Rounds:** {run.get('rounds')} · **Agents:** {run.get('agents_count')} ({run.get('enriched_count')} web-enriched)")
    lines.append("")
    if r.get("implications_for_target"):
        lines.append(f"## Implications for target\n{r['implications_for_target']}\n")
    if r.get("how_market_reshapes"):
        lines.append(f"## How the market reshapes\n{r['how_market_reshapes']}\n")
    if r.get("strategic_postures"):
        lines.append("## Strategic postures")
        for p in r["strategic_postures"]:
            lines.append(f"- **{p.get('agent')}** ({p.get('stance')}): {p.get('move')}")
        lines.append("")
    if r.get("risks"):
        lines.append("## Risks")
        for x in r["risks"]:
            lines.append(f"- [{x.get('severity')}] {x.get('risk')}")
        lines.append("")
    if r.get("opportunities"):
        lines.append("## Opportunities")
        for x in r["opportunities"]:
            lines.append(f"- {x}")
        lines.append("")
    if r.get("recommended_actions"):
        lines.append("## Recommended actions")
        for x in r["recommended_actions"]:
            lines.append(f"- {x}")
        lines.append("")
    # Transcript
    lines.append("## Transcript")
    for rd in run.get("result", {}).get("rounds", []):
        lines.append(f"### Round {rd.get('round')}")
        for s in rd.get("statements", []):
            lines.append(f"- **{s.get('agent_name')}** ({s.get('reaction')}): {s.get('statement')}")
        lines.append("")
    if r.get("overall_outcome"):
        lines.append(f"**Overall outcome:** {r['overall_outcome']}")
    md = "\n".join(lines)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(md, headers={"Content-Disposition": f"attachment; filename=whatif_{run_id}.md"})
