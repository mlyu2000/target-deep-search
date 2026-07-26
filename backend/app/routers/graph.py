import asyncio
import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db, async_session as db_async_session
from app.models import Session as SessionModel
from app.schemas import BuildRequest, AnalyzeRequest, BuildResponse, GraphResponse
from app.graph_builder import GraphBuilder
from app.analyzers.competitive import CompetitiveAnalyzer
from app.analyzers.supplychain import SupplyChainAnalyzer
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["graph"])

status_queues: dict[str, asyncio.Queue] = {}
results_cache: dict[str, GraphResponse] = {}

ANALYZERS = {
    "graph": GraphBuilder,
    "competitive": CompetitiveAnalyzer,
    "supplychain": SupplyChainAnalyzer,
}


@router.post("/graph/build", response_model=BuildResponse)
async def build_graph(req: BuildRequest, db: AsyncSession = Depends(get_db)):
    return await _start_analyze(req.target, req.depth, "graph", db, req.max_pages, req.categories)


@router.post("/graph/analyze", response_model=BuildResponse)
async def analyze_graph(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    return await _start_analyze(req.target, req.depth, req.mode, db, req.max_pages, req.categories)


async def _start_analyze(
    target: str, depth: int, mode: str, db: AsyncSession,
    max_pages: int = 10, categories: list[str] = None,
) -> BuildResponse:
    task_id = str(uuid.uuid4())

    session = SessionModel(
        id=task_id,
        target=target,
        depth=depth,
        status="running",
        report_type=mode,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(session)
    await db.commit()

    status_queues[task_id] = asyncio.Queue()
    asyncio.create_task(_run_analysis(task_id, target, depth, mode, max_pages, categories))

    return BuildResponse(task_id=task_id)


async def _run_analysis(
    task_id: str, target: str, depth: int, mode: str,
    max_pages: int = 10, categories: list[str] = None,
):
    queue = status_queues.get(task_id)
    analyzer_cls = ANALYZERS.get(mode, GraphBuilder)

    async def emit(status: str, message: str, d: int = 1, **kwargs):
        if queue:
            update = {"status": status, "message": message, "depth": d, **kwargs}
            await queue.put(update)

    # Use own DB session (the one from Depends is closed after handler returns)
    async with db_async_session() as db:
        try:
            if mode == "graph":
                builder = GraphBuilder()
                result = await asyncio.wait_for(
                    builder.build(target, depth, emit, max_pages=max_pages, categories=categories),
                    timeout=600.0,
                )
            else:
                analyzer = analyzer_cls()
                result = await asyncio.wait_for(
                    analyzer.analyze(target, depth, emit, max_pages=max_pages, categories=categories),
                    timeout=600.0,
                )

            results_cache[task_id] = result

            session = await db.get(SessionModel, task_id)
            if session:
                session.status = "complete"
                session.graph_data = json.dumps(result.model_dump(), indent=2, default=str)
                session.updated_at = datetime.utcnow()
                await db.commit()

            await emit("complete", f"Analysis complete: {len(result.nodes)} entities, {len(result.edges)} relationships")

        except asyncio.TimeoutError:
            session = await db.get(SessionModel, task_id)
            if session:
                session.status = "error"
                session.error_msg = "Analysis timed out after 600 seconds"
                session.updated_at = datetime.utcnow()
                await db.commit()
            await emit("error", "Analysis timed out")
        except Exception as e:
            logger.exception("Build failed")
            session = await db.get(SessionModel, task_id)
            if session:
                session.status = "error"
                session.error_msg = str(e)
                session.updated_at = datetime.utcnow()
                await db.commit()
            await emit("error", f"Analysis failed: {str(e)}")

        finally:
            if queue:
                await queue.put(None)


@router.get("/graph/status/{task_id}")
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


@router.get("/graph/result/{task_id}")
async def get_result(task_id: str, db: AsyncSession = Depends(get_db)):
    if task_id in results_cache:
        return results_cache[task_id]

    session = await db.get(SessionModel, task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "running":
        raise HTTPException(status_code=409, detail="Graph is still building")
    if session.status == "error":
        return GraphResponse(
            target=session.target,
            depth=session.depth,
            nodes=[],
            edges=[],
            error=session.error_msg,
            report_type=session.report_type,
        )
    if session.graph_data:
        data = json.loads(session.graph_data)
        return GraphResponse(**data)

    raise HTTPException(status_code=404, detail="No graph data found")
