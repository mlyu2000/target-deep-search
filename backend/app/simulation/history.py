"""Append-only JSON store for completed What-if simulations.

Keeps a list of saved runs so business users can review, compare, and export
past scenarios. Persisted to backend/data/sim_runs.json (zero-infra, matches the
project's ephemeral-by-default design). Thread-safe enough for single-process use.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from typing import Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
STORE_PATH = os.path.join(DATA_DIR, "sim_runs.json")

_lock = threading.Lock()


def _ensure_store() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(STORE_PATH):
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump({"runs": []}, f)


def _read() -> dict[str, Any]:
    _ensure_store()
    with open(STORE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write(data: dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_run(
    target: str,
    scenario: str,
    rounds: int,
    graph_depth: int,
    agents_count: int,
    enriched_count: int,
    result: dict[str, Any],
) -> dict[str, Any]:
    """Persist a completed simulation. Returns the stored run record (incl. run_id)."""
    record = {
        "run_id": str(uuid.uuid4()),
        "target": target,
        "scenario": scenario,
        "rounds": rounds,
        "graph_depth": graph_depth,
        "agents_count": agents_count,
        "enriched_count": enriched_count,
        "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "result": result,
    }
    with _lock:
        data = _read()
        data["runs"].insert(0, record)  # newest first
        # cap history to avoid unbounded growth
        data["runs"] = data["runs"][:200]
        _write(data)
    return record


def list_runs() -> list[dict[str, Any]]:
    with _lock:
        data = _read()
        return [
            {
                "run_id": r["run_id"],
                "target": r["target"],
                "scenario": r["scenario"],
                "rounds": r["rounds"],
                "graph_depth": r.get("graph_depth"),
                "agents_count": r.get("agents_count"),
                "enriched_count": r.get("enriched_count"),
                "created_at": r.get("created_at"),
            }
            for r in data["runs"]
        ]


def get_run(run_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        data = _read()
        for r in data["runs"]:
            if r["run_id"] == run_id:
                return r
    return None


def delete_run(run_id: str) -> bool:
    with _lock:
        data = _read()
        before = len(data["runs"])
        data["runs"] = [r for r in data["runs"] if r["run_id"] != run_id]
        if len(data["runs"]) != before:
            _write(data)
            return True
    return False
