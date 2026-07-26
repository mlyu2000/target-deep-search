import pytest
from datetime import datetime
from sqlalchemy import text
from app.models import Session as SessionModel


class TestDatabase:
    @pytest.mark.asyncio
    async def test_create_tables(self, db_session):
        result = await db_session.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ))
        tables = [row[0] for row in result.fetchall()]
        assert "sessions" in tables

    @pytest.mark.asyncio
    async def test_create_session(self, db_session, test_session_data):
        session = SessionModel(**test_session_data)
        db_session.add(session)
        await db_session.commit()

        result = await db_session.execute(
            text("SELECT id, target, depth, status FROM sessions WHERE id = :id"),
            {"id": test_session_data["id"]}
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == test_session_data["id"]
        assert row[1] == "test_target"
        assert row[2] == 2
        assert row[3] == "pending"

    @pytest.mark.asyncio
    async def test_read_session_by_id(self, db_session, test_session_data):
        session = SessionModel(**test_session_data)
        db_session.add(session)
        await db_session.commit()

        result = await db_session.get(SessionModel, test_session_data["id"])
        assert result is not None
        assert result.target == "test_target"
        assert result.depth == 2

    @pytest.mark.asyncio
    async def test_read_non_existent_session(self, db_session):
        result = await db_session.get(SessionModel, "non-existent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_session_status(self, db_session, test_session_data):
        session = SessionModel(**test_session_data)
        db_session.add(session)
        await db_session.commit()

        session.status = "running"
        session.updated_at = datetime.utcnow()
        await db_session.commit()

        result = await db_session.get(SessionModel, test_session_data["id"])
        assert result.status == "running"

    @pytest.mark.asyncio
    async def test_delete_session(self, db_session, test_session_data):
        session = SessionModel(**test_session_data)
        db_session.add(session)
        await db_session.commit()

        await db_session.delete(session)
        await db_session.commit()

        result = await db_session.get(SessionModel, test_session_data["id"])
        assert result is None

    @pytest.mark.asyncio
    async def test_list_sessions_ordered(self, db_session):
        import uuid
        sessions_data = [
            {"id": str(uuid.uuid4()), "target": "A", "depth": 1, "status": "complete",
             "created_at": datetime(2024, 1, 1), "updated_at": datetime(2024, 1, 1), "graph_data": None},
            {"id": str(uuid.uuid4()), "target": "B", "depth": 2, "status": "complete",
             "created_at": datetime(2024, 1, 2), "updated_at": datetime(2024, 1, 2), "graph_data": None},
            {"id": str(uuid.uuid4()), "target": "C", "depth": 3, "status": "complete",
             "created_at": datetime(2024, 1, 3), "updated_at": datetime(2024, 1, 3), "graph_data": None},
        ]
        for sd in sessions_data:
            db_session.add(SessionModel(**sd))
        await db_session.commit()

        result = await db_session.execute(
            text("SELECT target FROM sessions ORDER BY created_at DESC")
        )
        rows = result.fetchall()
        assert [r[0] for r in rows] == ["C", "B", "A"]

    @pytest.mark.asyncio
    async def test_graph_data_storage(self, db_session, test_session_data, sample_graph_data):
        import json
        test_session_data["graph_data"] = json.dumps(sample_graph_data)
        session = SessionModel(**test_session_data)
        db_session.add(session)
        await db_session.commit()

        result = await db_session.get(SessionModel, test_session_data["id"])
        stored = json.loads(result.graph_data)
        assert stored["target"] == "test_target"
        assert len(stored["nodes"]) == 2
        assert len(stored["edges"]) == 1
