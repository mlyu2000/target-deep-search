import pytest
from app.schemas import GraphResponse, NodeSchema, EdgeSchema
from app.analyzers.competitive import CompetitiveAnalyzer
from app.analyzers.supplychain import SupplyChainAnalyzer
from app.simulation.centrality import rank_entities


def _graph(target="Microsoft", target_id="microsoft_corp"):
    """Graph where the target node slug differs from the raw target string,
    mirroring the real foundation-seeded case ('Microsoft' -> 'microsoft_corp')."""
    nodes = [
        NodeSchema(id=target_id, name=target, type="organization", description="Target"),
        # duplicate low-degree "Microsoft" node (web-extracted) must NOT be picked
        NodeSchema(id="microsoft", name="Microsoft", type="organization", description="web"),
        NodeSchema(id="apple_inc", name="Apple", type="organization", description=""),
        NodeSchema(id="amazon_com", name="Amazon", type="organization", description=""),
        NodeSchema(id="google_al", name="Google", type="organization", description=""),
        NodeSchema(id="windows", name="Windows", type="product", description=""),
        NodeSchema(id="satya_nadella", name="Satya Nadella", type="person", description="CEO"),
        NodeSchema(id="intel_corp", name="Intel", type="organization", description=""),
        NodeSchema(id="tsmc", name="TSMC", type="organization", description=""),
    ]
    edges = [
        EdgeSchema(source=target_id, target="apple_inc", type="competes", strength=4),
        EdgeSchema(source=target_id, target="amazon_com", type="competes", strength=4),
        EdgeSchema(source=target_id, target="google_al", type="competes", strength=4),
        # duplicate Intel relationship (same supplier via two edge types) -> must dedup in supply chain
        EdgeSchema(source=target_id, target="intel_corp", type="supplies", strength=3),
        EdgeSchema(source=target_id, target="intel_corp", type="part_of", strength=2),
        EdgeSchema(source=target_id, target="tsmc", type="supplies", strength=3),
        EdgeSchema(source=target_id, target="satya_nadella", type="employs", strength=5),
        EdgeSchema(source=target_id, target="windows", type="developed", strength=5),
        EdgeSchema(source="intel_corp", target="tsmc", type="supplies", strength=3),
        # low-degree duplicate microsoft node has no edges -> resolver must ignore it
    ]
    return GraphResponse(target=target, depth=2, nodes=nodes, edges=edges)


@pytest.mark.asyncio
async def test_competitive_finds_competitors_despite_slug_mismatch():
    g = _graph()
    report = await CompetitiveAnalyzer().generate_report(g, "Microsoft", 2)
    names = {c["name"] for c in report["competitors"]}
    assert "Apple" in names and "Amazon" in names and "Google" in names
    assert len(report["competitors"]) >= 3


@pytest.mark.asyncio
async def test_supplychain_no_duplicate_tier1():
    g = _graph()
    report = await SupplyChainAnalyzer().generate_report(g, "Microsoft", 2)
    tier1_names = [t["name"] for t in report["tier_1"]]
    assert len(tier1_names) == len(set(tier1_names)), f"dup tier_1: {tier1_names}"
    # Intel appears via two edges (supplies + part_of) but must be one tier_1 row
    assert tier1_names.count("Intel") == 1


@pytest.mark.asyncio
async def test_supplychain_geo_risks_no_duplicate():
    nodes = [
        NodeSchema(id="microsoft_corp", name="Microsoft", type="organization"),
        NodeSchema(id="loc1", name="Beijing, China", type="location"),
    ]
    edges = []
    g = GraphResponse(target="Microsoft", depth=1, nodes=nodes, edges=edges)
    report = await SupplyChainAnalyzer().generate_report(g, "Microsoft", 1)
    keys = {(r["region"], r["location"]) for r in report["geo_risks"]}
    assert len(report["geo_risks"]) == len(keys)


def test_kol_excludes_products_and_tech():
    g = _graph()
    ranked = rank_entities(g.model_dump(), top_k=10)
    types = {m["type"] for m in ranked}
    assert "product" not in types, f"product leaked into KOL: {ranked}"
    assert "technology" not in types
    # target may be present but is an organization, fine
    assert all(m["type"] in ("person", "organization") for m in ranked)


def test_dedup_merges_target_variants():
    """'Microsoft' and 'Microsoft Corporation' must merge into one node
    (legal-suffix-aware), so the target is a single canonical hub."""
    from app.graph_builder import GraphBuilder
    gb = GraphBuilder()
    ents = {
        "microsoft": {"id": "microsoft", "name": "Microsoft", "type": "organization",
                      "description": "", "images": [], "mention_count": 3},
        "microsoft_corp": {"id": "microsoft_corp", "name": "Microsoft Corporation", "type": "organization",
                           "description": "A tech company", "images": [], "mention_count": 1},
    }
    rels = [
        {"source": "microsoft", "target": "windows", "type": "owns", "strength": 3},
        {"source": "microsoft_corp", "target": "bill_gates", "type": "founded", "strength": 5},
    ]
    merged = gb._dedup_entities(ents, rels)
    microsoft_ids = [i for i, e in merged.items() if "microsoft" in e["name"].lower()]
    assert len(microsoft_ids) == 1, f"expected 1 merged Microsoft node, got {microsoft_ids}"
    canonical = merged[microsoft_ids[0]]
    assert "Corporation" in canonical["name"], f"fuller name should win: {canonical['name']}"
    assert canonical["mention_count"] == 4  # 3 + 1 merged
