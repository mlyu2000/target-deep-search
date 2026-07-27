import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import Session as SessionModel
from app.schemas import SessionSchema, SessionListResponse

router = APIRouter(tags=["sessions"])


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionModel).order_by(desc(SessionModel.created_at))
    )
    sessions = result.scalars().all()
    return SessionListResponse(
        sessions=[
            SessionSchema(
                id=s.id,
                target=s.target,
                depth=s.depth,
                status=s.status,
                error_msg=s.error_msg,
                report_type=s.report_type,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in sessions
        ]
    )


@router.delete("/sessions")
async def clear_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SessionModel))
    sessions = result.scalars().all()
    for s in sessions:
        await db.delete(s)
    await db.commit()
    return {"ok": True, "deleted": len(sessions)}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"ok": True}


@router.get("/sessions/{session_id}/export")
async def export_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "running":
        raise HTTPException(status_code=409, detail="Graph is still building")
    if not session.graph_data:
        raise HTTPException(status_code=404, detail="No graph data found")

    data = json.loads(session.graph_data)
    return Response(
        content=json.dumps(data, indent=2, default=str),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="graph-{session_id[:8]}.json"',
        },
    )
