"""Centrality-based selection of the most influential entities for simulation.

This is a Python port of the frontend KOL ranking (frontend/src/analysis/kol.ts)
so the backend can pick the same top-K agents without re-implementing the math
in TypeScript. Influence = equal-weight blend of four normalized axes:
  - weighted degree (sum of edge strengths)
  - PageRank (power iteration, undirected)
  - betweenness (Brandes, bridge/cluster role)
  - mention count (crawl prominence)
"""
from __future__ import annotations

import math
from typing import Any


def _normalize(values: list[float]) -> list[float]:
    lo = min(values) if values else 0.0
    hi = max(values) if values else 0.0
    if hi - lo < 1e-9:
        return [0.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def pagerank(adj: dict[str, set[str]], d: float = 0.85, iters: int = 60) -> dict[str, float]:
    nodes = list(adj.keys())
    n = len(nodes)
    if n == 0:
        return {}
    pr = {nd: 1.0 / n for nd in nodes}
    out_deg = {nd: max(1, len(adj[nd])) for nd in nodes}
    for _ in range(iters):
        new_pr = {nd: (1 - d) / n for nd in nodes}
        for nd in nodes:
            share = pr[nd] / out_deg[nd]
            for nb in adj[nd]:
                new_pr[nb] += d * share
        pr = new_pr
    return pr


def betweenness(adj: dict[str, set[str]]) -> dict[str, float]:
    nodes = list(adj.keys())
    bt = {nd: 0.0 for nd in nodes}
    for s in nodes:
        stack: list[str] = []
        pred: dict[str, list[str]] = {nd: [] for nd in nodes}
        sigma: dict[str, float] = {nd: 0.0 for nd in nodes}
        dist: dict[str, int] = {nd: -1 for nd in nodes}
        sigma[s] = 1.0
        dist[s] = 0
        q = [s]
        while q:
            v = q.pop(0)
            stack.append(v)
            for w in adj[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    q.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
        delta: dict[str, float] = {nd: 0.0 for nd in nodes}
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                bt[w] += delta[w]
    n = len(nodes)
    if n > 2:
        scale = 1.0 / ((n - 1) * (n - 2))
        for nd in nodes:
            bt[nd] *= scale
    return bt


def rank_entities(
    graph: dict[str, Any], top_k: int = 6, include_target: bool = True
) -> list[dict[str, Any]]:
    """Return top-K entities by blended influence, as dicts with influence 0..1."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    ids = [n["id"] for n in nodes]
    if not ids:
        return []

    name_by = {n["id"]: n.get("name", n["id"]) for n in nodes}
    type_by = {n["id"]: n.get("type", "organization") for n in nodes}
    mentions_by = {n["id"]: int(n.get("mention_count", 0)) for n in nodes}

    adj: dict[str, set[str]] = {i: set() for i in ids}
    weighted_deg = {i: 0.0 for i in ids}
    for e in edges:
        s = e.get("source")
        t = e.get("target")
        if s in adj and t in adj:
            w = float(e.get("strength", 1))
            adj[s].add(t)
            adj[t].add(s)
            weighted_deg[s] += w
            weighted_deg[t] += w

    pr = pagerank(adj)
    bt = betweenness(adj)

    wd_n = _normalize([weighted_deg[i] for i in ids])
    pr_n = _normalize([pr.get(i, 0.0) for i in ids])
    bt_n = _normalize([bt.get(i, 0.0) for i in ids])
    mn_n = _normalize([float(mentions_by[i]) for i in ids])

    metrics = []
    for idx, i in enumerate(ids):
        influence = 0.25 * (wd_n[idx] + pr_n[idx] + bt_n[idx] + mn_n[idx])
        metrics.append({
            "id": i,
            "name": name_by[i],
            "type": type_by[i],
            "mentions": mentions_by[i],
            "weighted_degree": weighted_deg[i],
            "pagerank": pr.get(i, 0.0),
            "betweenness": bt.get(i, 0.0),
            "influence": influence,
        })

    metrics.sort(key=lambda m: m["influence"], reverse=True)
    selected = metrics[:top_k]
    if not include_target:
        target = (graph.get("target") or "").strip().lower()
        selected = [m for m in selected if m["name"].lower() != target][:top_k]
    return selected


if __name__ == "__main__":
    g = {
        "target": "Center",
        "nodes": [
            {"id": "c", "name": "Center", "type": "organization", "mention_count": 10},
            {"id": "a", "name": "Alpha", "type": "person", "mention_count": 3},
            {"id": "b", "name": "Beta", "type": "person", "mention_count": 2},
            {"id": "d", "name": "Delta", "type": "product", "mention_count": 1},
        ],
        "edges": [
            {"source": "c", "target": "a", "strength": 5},
            {"source": "c", "target": "b", "strength": 5},
            {"source": "c", "target": "d", "strength": 3},
            {"source": "a", "target": "b", "strength": 2},
        ],
    }
    for m in rank_entities(g, top_k=3):
        print(round(m["influence"], 3), m["name"])
