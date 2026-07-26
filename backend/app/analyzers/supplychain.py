import logging
from collections import Counter
from typing import Optional
from app.analyzers import BaseAnalyzer
from app.schemas import GraphResponse

logger = logging.getLogger(__name__)

SUPPLIER_REL_TYPES = {"supplies", "partnered", "collaborates_with", "outsources_to", "provider"}
LOCATION_TYPES = {"location"}
RISK_LOCATIONS = {"china", "russia", "taiwan", "ukraine", "venezuela", "iran", "north_korea"}


class SupplyChainAnalyzer(BaseAnalyzer):
    report_type = "supplychain"

    async def generate_report(self, graph: GraphResponse, target: str, depth: int) -> dict:
        target_id = self.builder.llm._sanitize_id(target)
        node_map = {n.id: n for n in graph.nodes}

        tier_1 = []
        tier_2 = []
        tier_3 = []
        locations = []
        single_source = []

        for edge in graph.edges:
            if edge.source == target_id:
                tier_1.append({
                    "name": node_map.get(edge.target, None).name if node_map.get(edge.target) else edge.target,
                    "relationship": edge.type,
                    "strength": edge.strength,
                    "description": edge.description or "",
                })
            if edge.target == target_id:
                tier_1.append({
                    "name": node_map.get(edge.source, None).name if node_map.get(edge.source) else edge.source,
                    "relationship": edge.type,
                    "strength": edge.strength,
                    "description": edge.description or "",
                })

        tier_1_ids = set()
        for t in tier_1:
            for nid, n in node_map.items():
                if n.name == t["name"]:
                    tier_1_ids.add(nid)

        seen_tier_2 = set()
        for edge in graph.edges:
            src_name = node_map.get(edge.source).name if node_map.get(edge.source) else edge.source
            tgt_name = node_map.get(edge.target).name if node_map.get(edge.target) else edge.target
            src_is_t1 = edge.source in tier_1_ids
            tgt_is_t1 = edge.target in tier_1_ids
            src_is_target = edge.source == target_id
            tgt_is_target = edge.target == target_id

            if not src_is_target and not tgt_is_target and (src_is_t1 or tgt_is_t1):
                sub_name = tgt_name if src_is_t1 else src_name
                if sub_name not in seen_tier_2 and sub_name != target:
                    seen_tier_2.add(sub_name)
                    tier_2.append({
                        "name": sub_name,
                        "via": src_name if src_is_t1 else tgt_name,
                        "relationship": edge.type,
                    })

        for node in graph.nodes:
            if node.type in LOCATION_TYPES:
                locations.append({
                    "name": node.name,
                    "description": node.description or "",
                    "risk": any(r in node.name.lower() for r in RISK_LOCATIONS),
                })

        node_connection_counts = Counter()
        for edge in graph.edges:
            if edge.source != target_id and edge.target != target_id:
                node_connection_counts[edge.source] += 1
                node_connection_counts[edge.target] += 1

        single_source = [
            {"name": node_map.get(nid).name if node_map.get(nid) else nid, "connections": count}
            for nid, count in node_connection_counts.most_common()
            if count == 1 and node_map.get(nid) and node_map[nid].name != target
        ][:10]

        geo_risks = []
        region_counts = Counter()
        for loc in locations:
            for risk_region in RISK_LOCATIONS:
                if risk_region in loc["name"].lower():
                    region_counts[risk_region] += 1
                    geo_risks.append({
                        "region": risk_region.title(),
                        "location": loc["name"],
                        "count": region_counts[risk_region],
                    })

        tier_1_names = set(t["name"] for t in tier_1)
        tier_2 = [t for t in tier_2 if t["name"] not in tier_1_names][:20]

        summary = (
            f"Supply chain analysis of **{target}**: "
            f"{len(tier_1)} direct suppliers/partners, "
            f"{len(tier_2)} sub-suppliers, "
            f"{len(locations)} geographic locations"
            + (f", {len(geo_risks)} geographic risk(s)" if geo_risks else "")
            + (f", {len(single_source)} single-source dependencies" if single_source else "")
            + "."
        )

        return {
            "type": "supplychain",
            "target": target,
            "summary": summary,
            "tier_1": tier_1[:20],
            "tier_2": tier_2[:20],
            "locations": locations[:20],
            "geo_risks": geo_risks[:10],
            "single_source_deps": single_source[:10],
        }
