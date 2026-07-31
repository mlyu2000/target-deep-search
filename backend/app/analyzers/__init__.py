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
        """
        t_low = (target or "").strip().lower()
        if not t_low:
            return ""
        t_san = self.builder.llm._sanitize_id(target)
        name_by = {n.id: (n.name or "").strip().lower() for n in graph.nodes}
        # 1) exact / starts-with name match
        for nid, nm in name_by.items():
            if nm == t_low or nm.startswith(t_low + " ") or t_low in nm.split():
                return nid
        # 2) sanitized id containment (either direction)
        for nid in name_by:
            if nid == t_san or t_san in nid or nid in t_san:
                return nid
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
