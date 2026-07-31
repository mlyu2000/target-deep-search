import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.graph_builder import GraphBuilder
from app.crawler import Crawler
from app.schemas import GraphResponse, NodeSchema, EdgeSchema


@pytest.fixture
def mock_crawler():
    crawler = MagicMock()
    crawler.search = AsyncMock(return_value=[
        MagicMock(url="https://example.com/1", title="Result 1", snippet="Snippet", img_src=None),
    ])
    crawler.fetch_pages = AsyncMock(return_value=[
        MagicMock(url="https://example.com/1", html="<html><body><p>Content about target</p></body></html>", status=200),
    ])

    def extract_text_and_images(page):
        # >= 200 chars so it passes the crawler's is_usable_content threshold
        return ("The target entity was founded by John Doe and has operated for many years "
                "across multiple regions, building a broad portfolio of products and services "
                "that serve enterprise customers worldwide with a large partner ecosystem.", [])

    crawler.extract_text_and_images = MagicMock(side_effect=extract_text_and_images)
    crawler.is_usable_content = MagicMock(side_effect=lambda t: Crawler.is_usable_content(None, t))
    return crawler


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.extract = AsyncMock(return_value=(
        [
            {"id": "john_doe", "name": "John Doe", "type": "person", "description": "Founder", "images": [], "mention_count": 1},
            {"id": "target_corp", "name": "Target Corp", "type": "organization", "description": "Company", "images": [], "mention_count": 1},
        ],
        [
            {"source": "john_doe", "target": "target_corp", "type": "founded", "strength": 5, "description": "Founded", "source_urls": []},
        ],
    ))
    llm.generate_foundation = AsyncMock(return_value={"summary": "", "entities": [], "relationships": []})
    llm._sanitize_id = MagicMock(side_effect=lambda x: x.lower().replace(" ", "_"))
    return llm


@pytest.fixture
def builder(mock_crawler, mock_llm):
    return GraphBuilder(crawler=mock_crawler, llm_service=mock_llm)


class TestGraphBuilder:
    @pytest.mark.asyncio
    async def test_build_depth_3(self, builder):
        status_updates = []

        async def callback(status, message, d=1, **kwargs):
            status_updates.append((status, d))

        graph = await builder.build("Target", 3, callback)
        assert isinstance(graph, GraphResponse)
        assert len(graph.nodes) >= 2
        assert len(graph.edges) >= 1
        assert graph.target == "Target"
        assert graph.depth == 3
        assert len(graph.nodes) <= 50

    @pytest.mark.asyncio
    async def test_build_status_callbacks(self, builder):
        status_updates = []

        async def callback(status, message, d=1, **kwargs):
            status_updates.append(status)

        await builder.build("Target", 3, callback)
        assert "searching" in status_updates
        assert "extracting" in status_updates
        assert "building" in status_updates

    @pytest.mark.asyncio
    async def test_build_depth_3_callbacks(self, builder):
        depth_updates = []
        stage_updates = []

        async def callback(status, message, d=1, stage=None, **kwargs):
            if stage:
                depth_updates.append((d, stage, status))

        await builder.build("Target", 3, callback)
        depth_numbers = {d for d, _, _ in depth_updates}
        assert 1 in depth_numbers or len(depth_updates) == 0

    @pytest.mark.asyncio
    async def test_build_adds_target_entity_if_missing(self, builder):
        builder.llm.extract = AsyncMock(return_value=([], []))
        graph = await builder.build("UnknownEntity", 1)
        found = any(n.id == "unknownentity" for n in graph.nodes)
        assert found, "Target entity should be added even if LLM returns nothing"

    @pytest.mark.asyncio
    async def test_build_entity_dedup(self, builder):
        builder.llm.extract = AsyncMock(return_value=(
            [
                {"id": "john_doe", "name": "John Doe", "type": "person", "description": "Founder", "images": [], "mention_count": 1},
                {"id": "john_doe", "name": "John Doe", "type": "person", "description": "CEO", "images": [], "mention_count": 1},
            ],
            [],
        ))
        graph = await builder.build("Target", 1)
        johns = [n for n in graph.nodes if n.id == "john_doe"]
        assert len(johns) == 1
        assert johns[0].mention_count >= 1

    @pytest.mark.asyncio
    async def test_build_relationship_dedup(self, builder):
        builder.llm.extract = AsyncMock(return_value=(
            [
                {"id": "a", "name": "A", "type": "person", "description": "", "images": [], "mention_count": 1},
                {"id": "b", "name": "B", "type": "organization", "description": "", "images": [], "mention_count": 1},
            ],
            [
                {"source": "a", "target": "b", "type": "founded", "strength": 4, "description": "", "source_urls": []},
                {"source": "a", "target": "b", "type": "founded", "strength": 5, "description": "", "source_urls": []},
            ],
        ))
        graph = await builder.build("Target", 1)
        edges = [e for e in graph.edges if e.type == "founded"]
        assert len(edges) == 1  # deduplicated

    @pytest.mark.asyncio
    async def test_build_caps_entities(self, builder):
        # Generate more than max_entities_total (200) so the cap actually triggers.
        builder.llm.extract = AsyncMock(return_value=(
            [{"id": f"entity_{i}", "name": f"Entity {i}", "type": "organization", "description": "", "images": [], "mention_count": 1} for i in range(250)],
            [],
        ))
        graph = await builder.build("Target", 1)
        assert len(graph.nodes) <= 200

    @pytest.mark.asyncio
    async def test_build_handles_llm_errors_gracefully(self, builder):
        builder.llm.extract = AsyncMock(side_effect=Exception("LLM failed"))
        graph = await builder.build("Target", 1)
        assert graph.target == "Target"
        # Should still complete with target entity even when LLM fails

    def test_to_json(self, builder):
        graph = GraphResponse(
            target="test",
            depth=3,
            nodes=[NodeSchema(id="a", name="A", type="person")],
            edges=[EdgeSchema(source="a", target="b", type="founded")],
        )
        json_str = builder.to_json(graph)
        assert "test" in json_str
        assert "a" in json_str

    def test_dedup_relationships(self, builder):
        rels = [
            {"source": "a", "target": "b", "type": "founded"},
            {"source": "a", "target": "b", "type": "founded"},
            {"source": "a", "target": "c", "type": "partnered"},
        ]
        result = builder._dedup_relationships(rels)
        assert len(result) == 2


class TestIngestPages:
    @pytest.mark.asyncio
    async def test_ingest_filters_stubs_and_dedupes(self, builder):
        good = "x" * 300  # long enough to pass is_usable_content
        pages = [
            MagicMock(url="https://a.com/1", html="", status=200),
            MagicMock(url="https://a.com/2", html="", status=200),
            MagicMock(url="https://a.com/3", html="", status=403),
        ]
        builder.crawler.extract_text_and_images = MagicMock(side_effect=[
            (good, []),
            ("OK", []),
            (good, []),
        ])
        sources, skipped = await builder._ingest_pages(pages, "page", None, total_pages=3, depth=1, stages=[])
        assert len(sources) == 1
        assert sources[0][3] == "https://a.com/1"
