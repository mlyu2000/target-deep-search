import pytest
from unittest.mock import AsyncMock, MagicMock
from app.simulation.centrality import rank_entities
from app.simulation.persona import build_personas, AgentPersona
from app.simulation.engine import run_simulation, SimulationResult


SAMPLE_GRAPH = {
    "target": "HPE",
    "nodes": [
        {"id": "hpe", "name": "Hewlett Packard Enterprise", "type": "organization", "mention_count": 12, "description": "Enterprise tech company."},
        {"id": "ceo", "name": "Antonio Neri", "type": "person", "mention_count": 5, "description": "CEO of HPE."},
        {"id": "comp", "name": "Dell", "type": "organization", "mention_count": 4, "description": "Competitor."},
        {"id": "prod", "name": "GreenLake", "type": "product", "mention_count": 3, "description": "HPE cloud service."},
    ],
    "edges": [
        {"source": "ceo", "target": "hpe", "strength": 5, "type": "ceo_of"},
        {"source": "hpe", "target": "comp", "strength": 4, "type": "competes"},
        {"source": "hpe", "target": "prod", "strength": 3, "type": "owns"},
    ],
}


def test_rank_entities_returns_top_k():
    ranked = rank_entities(SAMPLE_GRAPH, top_k=3)
    assert len(ranked) == 3
    assert ranked[0]["influence"] >= ranked[-1]["influence"]
    # target should be in top results when influential
    assert any(r["id"] == "hpe" for r in ranked)


def test_rank_entities_empty_graph():
    assert rank_entities({"nodes": [], "edges": []}) == []


class TestBuildPersonas:
    @pytest.mark.asyncio
    async def test_build_personas_uses_search_when_enrich(self):
        # Mock crawler that returns usable context so enriched=True.
        crawler = MagicMock()
        crawler.search = AsyncMock(return_value=[
            MagicMock(url="https://x.com/a", title="A", snippet="snippet a"),
        ])
        crawler.dedupe_urls = MagicMock(side_effect=lambda urls: urls)
        crawler.fetch_pages = AsyncMock(return_value=[
            MagicMock(url="https://x.com/a", status=200, html="<p>real context about entity</p>"),
        ])
        crawler.extract_text = MagicMock(return_value="real context about entity " * 30)  # >100 chars
        crawler.is_usable_content = MagicMock(return_value=True)

        llm = MagicMock()
        llm.chat_json = AsyncMock(return_value={
            "bio": "Known enterprise firm.",
            "persona": "Acts as a cautious incumbent protecting its installed base.",
            "stance": "neutral",
            "interests": ["protect enterprise installed base"],
            "dependencies": ["supply chain", "channel partners"],
            "red_lines": ["never abandon enterprise customers"],
            "traits_sourced": ["from web"],
            "inferred": [],
        })

        personas = await build_personas(SAMPLE_GRAPH, llm, top_k=2, enrich=True, crawler=crawler)
        assert len(personas) == 2
        assert all(p.enriched for p in personas)
        assert all(len(p.interests) > 0 for p in personas), "strategic interests captured"
        assert all(len(p.dependencies) > 0 for p in personas), "dependencies captured"
        # LLM should have been called once per persona
        assert llm.chat_json.await_count == 2

    @pytest.mark.asyncio
    async def test_build_personas_falls_back_when_search_empty(self):
        crawler = MagicMock()
        crawler.search = AsyncMock(return_value=[])
        crawler.dedupe_urls = MagicMock(side_effect=lambda urls: urls)
        crawler.fetch_pages = AsyncMock(return_value=[])
        llm = MagicMock()
        llm.chat_json = AsyncMock(return_value={
            "bio": "Fallback bio.", "persona": "Fallback persona.", "stance": "neutral",
        })

        personas = await build_personas(SAMPLE_GRAPH, llm, top_k=2, enrich=True, crawler=crawler)
        assert len(personas) == 2
        # enriched False because search returned nothing usable
        assert all(not p.enriched for p in personas)


class TestRunSimulation:
    @pytest.mark.asyncio
    async def test_run_simulation_variable_rounds(self):
        personas = [
            AgentPersona(id="a", name="A", type="org", bio="b", persona="p"),
            AgentPersona(id="b", name="B", type="org", bio="b", persona="p"),
        ]
        llm = MagicMock()
        llm.chat_json = AsyncMock(side_effect=[
            {"reaction": "support", "statement": "I support it.", "new_stance": "support"},
            {"reaction": "oppose", "statement": "I oppose.", "new_stance": "oppose"},
            {"reaction": "support", "statement": "Still support.", "new_stance": "support"},
            {"reaction": "neutral", "statement": "Undecided.", "new_stance": "neutral"},
            # report call (strategy memo)
            {
                "implications_for_target": "Mixed impact on HPE.",
                "strategic_postures": [{"agent": "A", "stance": "support", "move": "double down"}, {"agent": "B", "stance": "oppose", "move": "hedge"}],
                "risks": [{"risk": "supply shock", "severity": "high"}],
                "opportunities": ["new markets"],
                "recommended_actions": ["secure supply", "diversify"],
                "overall_outcome": "contested",
            },
        ])

        # rounds=2 (no until_stable) -> 2 rounds, 2 agent calls each = 4, +1 report
        res = await run_simulation(personas, "What if HPE merges?", llm, rounds=2, until_stable=False, target="HPE", graph=SAMPLE_GRAPH)
        assert isinstance(res, SimulationResult)
        assert len(res.rounds) == 2
        assert llm.chat_json.await_count == 5
        assert res.report.get("overall_outcome") == "contested"
        assert "implications_for_target" in res.report
        assert len(res.report.get("strategic_postures", [])) == 2
        assert len(res.report.get("recommended_actions", [])) == 2

    @pytest.mark.asyncio
    async def test_run_simulation_until_stable_stops(self):
        personas = [AgentPersona(id="a", name="A", type="org", bio="b", persona="p")]
        # round1: support -> support (shift). round2: support -> support (no shift) -> stable, stop.
        llm = MagicMock()
        llm.chat_json = AsyncMock(side_effect=[
            {"reaction": "support", "statement": "ok", "new_stance": "support"},
            {"reaction": "support", "statement": "ok", "new_stance": "support"},
            {"reaction": "support", "statement": "ok", "new_stance": "support"},  # not used if stable
            {"summary": "s", "positions": [], "agreement": [], "conflict": [], "risks": [], "overall_outcome": "support"},
        ])
        res = await run_simulation(personas, "scenario", llm, rounds=5, until_stable=True)
        # stable at round 2 -> stops, 2 round calls + 1 report
        assert len(res.rounds) == 2
        assert llm.chat_json.await_count == 3
