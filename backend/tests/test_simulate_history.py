import pytest
from app.simulation.history import save_run, list_runs, get_run, delete_run


def test_save_and_list_and_get():
    rec = save_run(
        target="HPE",
        scenario="What if HPE merges?",
        rounds=2,
        graph_depth=1,
        agents_count=3,
        enriched_count=2,
        result={"scenario": "x", "agents": [], "rounds": [], "report": {}},
    )
    assert "run_id" in rec
    runs = list_runs()
    assert any(r["run_id"] == rec["run_id"] for r in runs)
    full = get_run(rec["run_id"])
    assert full is not None
    assert full["target"] == "HPE"
    assert full["result"]["scenario"] == "x"


def test_delete():
    rec = save_run(
        target="Dell", scenario="s", rounds=1, graph_depth=1,
        agents_count=1, enriched_count=0, result={"report": {}},
    )
    assert delete_run(rec["run_id"]) is True
    assert get_run(rec["run_id"]) is None
    assert delete_run("nonexistent") is False
