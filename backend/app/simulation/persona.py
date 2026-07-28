"""Persona builder for the what-if simulation.

Agents are the top-K most influential entities in the built graph (see
centrality.rank_entities). Each persona is GROUNDED in real evidence:
  1. the entity's own graph attributes (name/type/description) and its edges
  2. a targeted re-search via the project's built SearXNG crawler, so the
     agent's traits reflect characteristics "found on the internet" rather
     than being hallucinated.

This mirrors MiroFish's oasis_profile_generator (entity -> vivid grounded
persona) but uses the project's own search pipeline instead of Zep retrieval.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Optional

from app.config import settings
from app.crawler import Crawler
from app.simulation.centrality import rank_entities

PERSONA_SYSTEM = (
    "You are a strategy analyst building a ROLE-PLAY profile for a real business entity that will "
    "participate in a 'what-if' scenario simulation. You are NOT writing a corporate biography. "
    "You are defining the entity as a STRATEGIC ACTOR: what it wants, what it depends on, what "
    "would threaten it, and how it typically moves. Base the profile STRICTLY on the provided "
    "evidence (graph facts + web context). Ignore trivia (headquarters, founding date, slogans, "
    "boilerplate). Only keep traits that affect how the entity would respond to a business shock. "
    "Respond with ONLY valid JSON."
)

PERSONA_USER = """Entity to role-play:
Name: {name}
Type: {type}
Graph description: {description}
Known relationships to other entities (from graph): {relations}

Web context (real, retrieved — use ONLY for strategic posture, ignore trivia):
{context}

Build a STRATEGIC ACTOR profile so this entity can react to a business scenario in a panel with
other entities. Output JSON:
{{
  "bio": "1-2 sentence strategic summary (market position / role), NOT a bio",
  "persona": "first-person strategic brief: your core interests, dependencies, red lines, and the kind of move you typically make when the market shifts",
  "stance": "neutral",
  "interests": ["what this entity wants to protect or gain"],
  "dependencies": ["what it relies on — suppliers, the target, customers, regulations, tech"],
  "red_lines": ["conditions it would never accept / threats it would fight"],
  "traits_sourced": ["specific strategic facts taken from the web context"],
  "inferred": ["reasonable strategic inferences, clearly marked"]
}}

Rules:
- No product catalog, no headquarters, no founding story.
- Keep bio <= 40 words, persona <= 90 words, each list <= 4 items.
- If web context is empty, rely on graph facts + reasonable inference.
"""


@dataclass
class AgentPersona:
    id: str
    name: str
    type: str
    bio: str
    persona: str
    stance: str = "neutral"
    interests: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    red_lines: list[str] = field(default_factory=list)
    influence_weight: float = 1.0
    traits_sourced: list[str] = field(default_factory=list)
    inferred: list[str] = field(default_factory=list)
    enriched: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "bio": self.bio,
            "persona": self.persona,
            "stance": self.stance,
            "interests": self.interests,
            "dependencies": self.dependencies,
            "red_lines": self.red_lines,
            "influence_weight": self.influence_weight,
            "traits_sourced": self.traits_sourced,
            "inferred": self.inferred,
            "enriched": self.enriched,
        }


def _relations_text(graph: dict[str, Any], entity_id: str) -> str:
    rels = []
    name_by = {n["id"]: n.get("name", n["id"]) for n in graph.get("nodes", [])}
    for e in graph.get("edges", []):
        if e.get("source") == entity_id:
            rels.append(f"- {e.get('type', 'related')} -> {name_by.get(e.get('target'), e.get('target'))}")
        elif e.get("target") == entity_id:
            rels.append(f"- {name_by.get(e.get('source'), e.get('source'))} -> {e.get('type', 'related')} (them to entity)")
    return "\n".join(rels) if rels else "(none)"


async def enrich_entity(crawler: Crawler, name: str, desc: str) -> tuple[str, bool]:
    """Re-search the web for this entity and return a cleaned context string.

    Reuses the project's built SearXNG crawler plus the Phase-A data-quality
    hardening (is_usable_content + URL dedup). Returns (context, enriched_flag).
    On any failure, returns the graph description as a safe fallback.
    """
    try:
        results = await crawler.search(f"{name} strategic position competitive advantage dependencies recent news", max_results=5, categories=["general"])
        urls = crawler.dedupe_urls([r.url for r in results])
        pages = await crawler.fetch_pages(urls[:5])
        chunks = []
        for p in pages:
            if p.status and p.status >= 400:
                continue
            text = crawler.extract_text(p)
            if crawler.is_usable_content(text):
                chunks.append(text[:1500])
        if chunks:
            joined = "\n\n".join(chunks)[:6000]
            return joined, True
    except Exception as exc:  # search/network failure -> fall back gracefully
        import logging
        logging.getLogger("mirofish.persona").warning("enrich failed for %s: %s", name, exc)
    return (desc or f"Publicly known {name}."), False


async def build_personas(
    graph: dict[str, Any],
    llm,
    top_k: int = 6,
    enrich: bool = True,
    crawler: Optional[Crawler] = None,
    emit=None,
) -> list[AgentPersona]:
    """Build grounded personas for the top-K influential entities."""
    ranked = rank_entities(graph, top_k=top_k, include_target=True)
    if not ranked:
        return []

    crawler = crawler or Crawler()
    # Per-entity enrichment (parallel searches), capped for latency.
    contexts: dict[str, tuple[str, bool]] = {}
    if enrich:
        async def _enrich(m: dict[str, Any]):
            desc = next((n.get("description", "") for n in graph.get("nodes", []) if n["id"] == m["id"]), "")
            ctx, ok = await enrich_entity(crawler, m["name"], desc)
            contexts[m["id"]] = (ctx, ok)
        if emit:
            await emit("simulating", f"Enriching {len(ranked)} agent profiles via web search...", 0)
        await asyncio.gather(*[_enrich(m) for m in ranked])

    personas: list[AgentPersona] = []
    for m in ranked:
        desc = next((n.get("description", "") for n in graph.get("nodes", []) if n["id"] == m["id"]), "")
        ctx, enriched = contexts.get(m["id"], (desc, False))
        user = PERSONA_USER.format(
            name=m["name"],
            type=m["type"],
            description=desc or "(no graph description)",
            relations=_relations_text(graph, m["id"]),
            context=ctx or "(no web context retrieved)",
        )
        try:
            data = await llm.chat_json(PERSONA_SYSTEM, user, temperature=0.4, max_tokens=1024)
            personas.append(AgentPersona(
                id=m["id"],
                name=m["name"],
                type=m["type"],
                bio=str(data.get("bio", desc))[:400],
                persona=str(data.get("persona", f"{m['name']} is a participant in the scenario."))[:600],
                stance=str(data.get("stance", "neutral")),
                interests=list(data.get("interests", []))[:4],
                dependencies=list(data.get("dependencies", []))[:4],
                red_lines=list(data.get("red_lines", []))[:4],
                influence_weight=round(0.5 + m["influence"], 3),
                traits_sourced=list(data.get("traits_sourced", []))[:8],
                inferred=list(data.get("inferred", []))[:8],
                enriched=enriched,
            ))
        except Exception:
            # Fallback persona so the simulation never breaks on one bad LLM call.
            personas.append(AgentPersona(
                id=m["id"],
                name=m["name"],
                type=m["type"],
                bio=desc or f"{m['name']} is a {m['type']} in the network.",
                persona=f"{m['name']} acts in its capacity as a {m['type']} within the scenario.",
                influence_weight=round(0.5 + m["influence"], 3),
                enriched=enriched,
            ))
    return personas

