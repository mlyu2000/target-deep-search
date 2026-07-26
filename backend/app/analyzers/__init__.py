from app.graph_builder import GraphBuilder
from app.schemas import GraphResponse
from typing import Callable, Optional


class BaseAnalyzer:
    def __init__(self):
        self.builder = GraphBuilder()

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
