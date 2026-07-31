import pytest
from pydantic import ValidationError


class TestBuildRequest:
    def test_valid_request(self):
        from app.schemas import BuildRequest
        req = BuildRequest(target="Tesla", depth=2)
        assert req.target == "Tesla"
        assert req.depth == 2

    def test_depth_out_of_range_low(self):
        from app.schemas import BuildRequest
        with pytest.raises(ValidationError):
            BuildRequest(target="Tesla", depth=0)

    def test_depth_out_of_range_high(self):
        from app.schemas import BuildRequest
        with pytest.raises(ValidationError):
            BuildRequest(target="Tesla", depth=6)

    def test_empty_target(self):
        from app.schemas import BuildRequest
        with pytest.raises(ValidationError):
            BuildRequest(target="", depth=1)

    def test_whitespace_target(self):
        from app.schemas import BuildRequest
        with pytest.raises(ValidationError):
            BuildRequest(target="   ", depth=1)

    def test_default_depth(self):
        from app.schemas import BuildRequest
        req = BuildRequest(target="Tesla")
        assert req.depth == 2

    def test_max_length_target(self):
        from app.schemas import BuildRequest
        with pytest.raises(ValidationError):
            BuildRequest(target="x" * 201, depth=1)


class TestNodeSchema:
    def test_valid_node(self):
        from app.schemas import NodeSchema
        node = NodeSchema(id="elon_musk", name="Elon Musk", type="person")
        assert node.id == "elon_musk"
        assert node.description == ""

    def test_invalid_type(self):
        from app.schemas import NodeSchema
        with pytest.raises(ValidationError):
            NodeSchema(id="test", name="Test", type="alien")

    def test_with_images(self):
        from app.schemas import NodeSchema, ImageSchema
        img = ImageSchema(url="https://example.com/img.jpg", source_page="https://example.com")
        node = NodeSchema(id="test", name="Test", type="person", images=[img])
        assert len(node.images) == 1
        assert node.images[0].url == "https://example.com/img.jpg"

    def test_mention_count_default(self):
        from app.schemas import NodeSchema
        node = NodeSchema(id="test", name="Test", type="organization")
        assert node.mention_count == 1


class TestEdgeSchema:
    def test_valid_edge(self):
        from app.schemas import EdgeSchema
        edge = EdgeSchema(source="a", target="b", type="founded", strength=4)
        assert edge.strength == 4

    def test_strength_out_of_range_low(self):
        from app.schemas import EdgeSchema
        with pytest.raises(ValidationError):
            EdgeSchema(source="a", target="b", type="founded", strength=0)

    def test_strength_out_of_range_high(self):
        from app.schemas import EdgeSchema
        with pytest.raises(ValidationError):
            EdgeSchema(source="a", target="b", type="founded", strength=6)

    def test_default_strength(self):
        from app.schemas import EdgeSchema
        edge = EdgeSchema(source="a", target="b", type="founded")
        assert edge.strength == 3


class TestGraphResponse:
    def test_valid_response(self):
        from app.schemas import GraphResponse, NodeSchema, EdgeSchema
        nodes = [
            NodeSchema(id="a", name="A", type="person"),
            NodeSchema(id="b", name="B", type="organization"),
        ]
        edges = [EdgeSchema(source="a", target="b", type="founded")]
        resp = GraphResponse(target="test", depth=1, nodes=nodes, edges=edges)
        assert len(resp.nodes) == 2
        assert len(resp.edges) == 1

    def test_error_field(self):
        from app.schemas import GraphResponse, NodeSchema, EdgeSchema
        resp = GraphResponse(
            target="test", depth=1,
            nodes=[], edges=[],
            error="Something went wrong"
        )
        assert resp.error == "Something went wrong"
