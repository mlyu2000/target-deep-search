from app.graph_builder import GraphBuilder
from app.schemas import GraphResponse
from typing import Callable, Optional


class BaseAnalyzer:
    def __init__(self):
        self.builder = GraphBuilder()

    def _resolve_target_id(self, graph: GraphResponse, target: str) -> str:
        """Return the node id that represents `target`.

        Matches by case-insensitive name OR sanitized id. The raw target string
        (e.g. "Microsoft") rarely equals the canonical slug the graph uses
        (e.g. "microsoft_corp" from the foundation step), so a naive
        `_sanitize_id(target)` lookup fails to find the target node and every
        target-relative analysis (competitors, supply chain, KOL role) breaks.

        When several nodes match the name (e.g. both "Microsoft" and
        "Microsoft Corporation" survive dedup), prefer the most-connected one
        (highest degree) — that is the canonical hub that the relationship edges
        actually attach to.
        """
        t_low = (target or "").strip().lower()
        if not t_low:
            return ""
        t_san = self.builder.llm._sanitize_id(target)
        name_by = {n.id: (n.name or "").strip().lower() for n in graph.nodes}

        # degree per node (used to pick the canonical hub among name matches)
        degree: dict[str, int] = {n.id: 0 for n in graph.nodes}
        for e in graph.edges:
            if e.source in degree:
                degree[e.source] += 1
            if e.target in degree:
                degree[e.target] += 1

        # Candidate node ids whose name references the target.
        candidates: list[str] = []
        for nid, nm in name_by.items():
            if nm == t_low or nm.startswith(t_low + " ") or t_low in nm.split():
                candidates.append(nid)
        if not candidates:
            for nid in name_by:
                if nid == t_san or t_san in nid or nid in t_san:
                    candidates.append(nid)
        if candidates:
            # prefer the most-connected candidate (canonical hub)
            return max(candidates, key=lambda nid: degree.get(nid, 0))
        return t_san  # graceful fallback (legacy behaviour)

    async def analyze(
        self,
        target: str,
        depth: int,
        status_callback: Optional[Callable] = None,
        max_pages: int = 10,
        categories: list[str] = None,
    ) -> GraphResponse:
        graph = await self.builder.build(target, depth, status_callback, max_pages=max_pages, categories=categories)
        report = await self.generate_report(graph, target, depth)
        graph.report = report
        graph.report_type = self.report_type
        return graph

    async def generate_report(self, graph: GraphResponse, target: str, depth: int) -> dict:
        raise NotImplementedError
