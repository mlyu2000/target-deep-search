import logging
from typing import Optional
from app.analyzers import BaseAnalyzer
from app.schemas import GraphResponse

logger = logging.getLogger(__name__)

COMPETITOR_REL_TYPES = {"competes", "rival", "competitor"}
ACQUISITION_REL_TYPES = {"acquired", "subsidiary_of", "owns"}
EXECUTIVE_TYPES = {"person"}
PARTNER_REL_TYPES = {"partnered", "supplies", "collaborates_with", "invested_in"}
PRODUCT_TYPES = {"product"}


class CompetitiveAnalyzer(BaseAnalyzer):
    report_type = "competitive"

    async def generate_report(self, graph: GraphResponse, target: str, depth: int) -> dict:
        competitors = []
        acquisitions = []
        executives = []
        partners = []
        products = []
        investors = []

        target_id = self.builder.llm._sanitize_id(target)
        node_map = {n.id: n for n in graph.nodes}

        for edge in graph.edges:
            if edge.source == target_id:
                target_node = node_map.get(edge.target)
                if not target_node:
                    continue
                if edge.type in ACQUISITION_REL_TYPES:
                    acquisitions.append({
                        "name": target_node.name,
                        "type": edge.type,
                        "description": edge.description or "",
                    })
                elif edge.type in PARTNER_REL_TYPES:
                    partners.append({
                        "name": target_node.name,
                        "type": edge.type,
                        "strength": edge.strength,
                        "description": edge.description or "",
                    })
                elif edge.type in COMPETITOR_REL_TYPES:
                    competitors.append({
                        "name": target_node.name,
                        "type": edge.type,
                        "strength": edge.strength,
                        "description": edge.description or "",
                    })

            if edge.target == target_id:
                source_node = node_map.get(edge.source)
                if not source_node:
                    continue
                if source_node.type in EXECUTIVE_TYPES:
                    executives.append({
                        "name": source_node.name,
                        "role": edge.type,
                        "description": edge.description or "",
                    })
                elif edge.type in PARTNER_REL_TYPES:
                    partners.append({
                        "name": source_node.name,
                        "type": edge.type,
                        "strength": edge.strength,
                        "description": edge.description or "",
                    })
                elif edge.type in COMPETITOR_REL_TYPES:
                    competitors.append({
                        "name": source_node.name,
                        "type": edge.type,
                        "strength": edge.strength,
                        "description": edge.description or "",
                    })

        for node in graph.nodes:
            if node.type in PRODUCT_TYPES:
                products.append({
                    "name": node.name,
                    "description": node.description or "",
                })
            if node.type == "person" and node.id != target_id:
                already = any(e["name"] == node.name for e in executives)
                if not already:
                    executives.append({
                        "name": node.name,
                        "role": "unknown",
                        "description": node.description or "",
                    })

        competitor_names = set()
        unique_competitors = []
        for c in competitors:
            if c["name"] not in competitor_names:
                competitor_names.add(c["name"])
                unique_competitors.append(c)

        partner_names = set()
        unique_partners = []
        for p in partners:
            if p["name"] not in partner_names:
                partner_names.add(p["name"])
                unique_partners.append(p)

        acquisition_names = set()
        unique_acquisitions = []
        for a in acquisitions:
            if a["name"] not in acquisition_names:
                acquisition_names.add(a["name"])
                unique_acquisitions.append(a)

        executive_names = set()
        unique_executives = []
        for e in executives:
            if e["name"] not in executive_names:
                executive_names.add(e["name"])
                unique_executives.append(e)

        product_names = set()
        unique_products = []
        for p in products:
            if p["name"] not in product_names:
                product_names.add(p["name"])
                unique_products.append(p)

        summary = (
            f"Analysis of **{target}**: "
            f"{len(unique_competitors)} competitors, "
            f"{len(unique_acquisitions)} acquisitions, "
            f"{len(unique_executives)} executives/people, "
            f"{len(unique_partners)} partners, "
            f"{len(unique_products)} products identified from "
            f"{len(graph.nodes)} entities and {len(graph.edges)} relationships."
        )

        return {
            "type": "competitive",
            "target": target,
            "summary": summary,
            "competitors": unique_competitors[:20],
            "acquisitions": unique_acquisitions[:20],
            "executives": unique_executives[:20],
            "partners": unique_partners[:20],
            "products": unique_products[:20],
        }
