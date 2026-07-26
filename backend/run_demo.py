"""
Repeatable demo runner for Target Deep Search.
Builds a relationship network from SearXNG-crawled info via local LLM extraction,
then writes the graph JSON + analyzer report to results/.

Usage:
    source venv/bin/activate
    python run_demo.py --target "Hewlett Packard Enterprise" --mode competitive --depth 2
"""
import argparse
import asyncio
import json
import os
from datetime import datetime

from app.graph_builder import GraphBuilder
from app.analyzers.competitive import CompetitiveAnalyzer
from app.analyzers.supplychain import SupplyChainAnalyzer

ANALYZERS = {"graph": None, "competitive": CompetitiveAnalyzer, "supplychain": SupplyChainAnalyzer}


async def main(target, mode, depth, max_pages):
    print(f"[demo] target={target!r} mode={mode} depth={depth} max_pages={max_pages}")

    if mode == "graph":
        builder = GraphBuilder()
        graph = await builder.build(target, depth, max_pages=max_pages)
        report = None
    else:
        analyzer_cls = ANALYZERS[mode]
        analyzer = analyzer_cls()
        graph = await analyzer.analyze(target, depth, max_pages=max_pages)
        report = graph.report

    out_dir = os.path.join(os.path.dirname(__file__), "results")
    os.makedirs(out_dir, exist_ok=True)
    slug = target.lower().replace(" ", "_")[:40]
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    fname = f"{slug}_{mode}_d{depth}_{ts}.json"
    path = os.path.join(out_dir, fname)
    with open(path, "w") as f:
        json.dump(graph.model_dump(), f, indent=2, default=str)

    print(f"[demo] DONE -> {len(graph.nodes)} nodes, {len(graph.edges)} edges")
    print(f"[demo] saved: {path}")
    if report:
        print("[demo] report summary:")
        print("   " + report.get("summary", ""))
    return path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", default="Hewlett Packard Enterprise")
    ap.add_argument("--mode", default="competitive", choices=["graph", "competitive", "supplychain"])
    ap.add_argument("--depth", type=int, default=2)
    ap.add_argument("--max-pages", type=int, default=10)
    args = ap.parse_args()
    asyncio.run(main(args.target, args.mode, args.depth, args.max_pages))
