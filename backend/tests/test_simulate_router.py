import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_simulate_endpoint_requires_scenario():
    client = TestClient(app)
    resp = client.post("/api/simulate", json={"graph": {"nodes": [{"id": "a", "name": "A", "type": "org"}], "edges": []}, "scenario": ""})
    assert resp.status_code == 400


def test_simulate_endpoint_requires_graph():
    client = TestClient(app)
    resp = client.post("/api/simulate", json={"graph": {}, "scenario": "what if?"})
    assert resp.status_code == 400


def test_simulate_endpoint_accepts_valid_request():
    client = TestClient(app)
    resp = client.post("/api/simulate", json={
        "graph": {"nodes": [{"id": "a", "name": "A", "type": "org"}], "edges": []},
        "scenario": "what if A acquires B?",
        "rounds": 2,
    })
    assert resp.status_code == 200
    assert "task_id" in resp.json()


def test_simulate_result_404_for_unknown():
    client = TestClient(app)
    resp = client.get("/api/simulate/result/does-not-exist")
    assert resp.status_code in (404, 409)
