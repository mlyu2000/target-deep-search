import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db
from app.models import Session as SessionModel


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    db.get = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def client(mock_db):
    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def make_session(id, target, depth=1, status="complete", error_msg=None, graph_data=None):
    from datetime import datetime
    s = SessionModel()
    s.id = id
    s.target = target
    s.depth = depth
    s.status = status
    s.error_msg = error_msg
    s.graph_data = graph_data
    s.created_at = datetime.utcnow()
    s.updated_at = datetime.utcnow()
    return s


class TestSessionsRouter:
    @pytest.mark.asyncio
    async def test_list_sessions_empty(self, client, mock_db):
        # Mock scalars().all()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        response = await client.get("/api/sessions")
        assert response.status_code == 200
        assert response.json() == {"sessions": []}

    @pytest.mark.asyncio
    async def test_list_sessions_with_data(self, client, mock_db):
        sessions = [
            make_session("1", "Tesla"),
            make_session("2", "OpenAI"),
            make_session("3", "Python"),
        ]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sessions
        mock_db.execute.return_value = mock_result

        response = await client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) == 3
        assert data["sessions"][0]["target"] == "Tesla"

    @pytest.mark.asyncio
    async def test_delete_session_valid(self, client, mock_db):
        mock_db.get = AsyncMock(return_value=make_session("1", "Tesla"))

        response = await client.delete("/api/sessions/1")
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    @pytest.mark.asyncio
    async def test_delete_session_invalid(self, client, mock_db):
        mock_db.get = AsyncMock(return_value=None)

        response = await client.delete("/api/sessions/non-existent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_export_session_valid(self, client, mock_db):
        mock_db.get = AsyncMock(return_value=make_session(
            "1", "Tesla", graph_data='{"nodes": [], "edges": [], "target": "Tesla", "depth": 1}'
        ))

        response = await client.get("/api/sessions/1/export")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        assert "Content-Disposition" in response.headers

    @pytest.mark.asyncio
    async def test_export_session_still_running(self, client, mock_db):
        s = make_session("1", "Tesla")
        s.status = "running"
        mock_db.get = AsyncMock(return_value=s)

        response = await client.get("/api/sessions/1/export")
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_export_session_non_existent(self, client, mock_db):
        mock_db.get = AsyncMock(return_value=None)

        response = await client.get("/api/sessions/none/export")
        assert response.status_code == 404
