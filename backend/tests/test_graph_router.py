import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db


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


class TestGraphRouter:
    @pytest.mark.asyncio
    async def test_build_graph_valid(self, client, mock_db):
        response = await client.post("/api/graph/build", json={"target": "Tesla", "depth": 3})
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data

    @pytest.mark.asyncio
    async def test_build_graph_depth_3_multi_level(self, client, mock_db):
        response = await client.post("/api/graph/build", json={"target": "Tesla", "depth": 3})
        assert response.status_code == 200
        assert "task_id" in response.json()

    @pytest.mark.asyncio
    async def test_build_graph_invalid_depth(self, client):
        # depth 5 is valid (new upper bound); 6 is out of range
        ok = await client.post("/api/graph/build", json={"target": "Tesla", "depth": 5})
        assert ok.status_code == 200
        response = await client.post("/api/graph/build", json={"target": "Tesla", "depth": 6})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_build_graph_empty_target(self, client):
        response = await client.post("/api/graph/build", json={"target": "", "depth": 3})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_status_invalid_task(self, client):
        response = await client.get("/api/graph/status/non-existent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_result_invalid_task(self, client, mock_db):
        mock_db.get = AsyncMock(return_value=None)
        response = await client.get("/api/graph/result/non-existent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    @pytest.mark.asyncio
    async def test_result_still_running(self, client, mock_db):
        from app.models import Session as SessionModel
        mock_session = SessionModel()
        mock_session.status = "running"
        mock_session.target = "test"
        mock_session.depth = 1
        mock_db.get = AsyncMock(return_value=mock_session)

        response = await client.get("/api/graph/result/test-id")
        assert response.status_code == 409
        assert "still building" in response.json()["detail"]
