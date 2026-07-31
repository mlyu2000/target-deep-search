import asyncio
import json
import logging
import re
import time
from difflib import SequenceMatcher
from typing import Callable, Optional
from datetime import datetime
from app.crawler import Crawler, CrawlerError
from app.llm_service import LLMService
from app.schemas import GraphResponse, NodeSchema, EdgeSchema, ImageSchema, StageInfo
from app.config import settings

logger = logging.getLogger(__name__)


STAGE_ORDER = ["foundation", "search", "fetch", "extract", "expand", "build", "done"]


class GraphBuilder:
    def __init__(self, crawler: Crawler = None, llm_service: LLMService = None):
        self.crawler = crawler or Crawler()
        self.llm = llm_service or LLMService()

    async def build(
        self,
        target: str,
        depth: int,
        status_callback: Optional[Callable] = None,
        max_pages: int = 10,
        categories: list[str] = None,
    ) -> GraphResponse:
        entities: dict[str, dict] = {}
        relationships: list[dict] = []
        stage_times: dict[str, float] = {}
        current_stages: list[dict] = [
            {"name": s, "status": "pending", "started_at": None, "elapsed": None}
            for s in STAGE_ORDER
        ]

        def _set_stage(stage_name: str, status: str = "active"):
            now = time.time()
            for s in current_stages:
                if s["name"] == stage_name:
                    if status == "active":
                        s["started_at"] = datetime.utcnow().isoformat()
                        stage_times[stage_name] = now
                    s["status"] = status
                    if status == "done" and stage_name in stage_times:
                        s["elapsed"] = round(now - stage_times[stage_name], 1)
                    break

        async def emit(status: str, message: str, d: int = 1, **kwargs):
            if status_callback:
                kwargs.setdefault("entities_found", len(entities))
                kwargs.setdefault("relationships_found", len(relationships))
                await status_callback(status, message, d, **kwargs)

        try:
            # Foundation stage: seed stable factual context from the model's base
            # knowledge BEFORE web search, so canonical entities exist and web
            # results enrich/verify rather than replace them. Detail scales with depth.
            _set_stage("foundation", "active")
            await emit("foundation", f"Generating foundational background for {target} (depth {depth})...", 1, stage="foundation", stages=current_stages)
            foundation = await self.llm.generate_foundation(target, depth)
            foundation_summary = foundation.get("summary", "")
            if foundation["entities"]:
                self._merge_entities(entities, foundation["entities"], [])
                relationships.extend(foundation["relationships"])
                await emit("foundation", f"Seeded {len(foundation['entities'])} foundational entities, {len(foundation['relationships'])} relationships", 1, stage="foundation", stages=current_stages)
            else:
                await emit("foundation", "No foundational data generated (continuing with web search)", 1, stage="foundation", stages=current_stages)
            _set_stage("foundation", "done")

            _set_stage("search", "active")
            cat_str = f" categories={categories}" if categories else ""
            await emit("searching", f"Searching {target}{cat_str}...", 1, stage="search", stages=current_stages)
            results = await self.crawler.search(target, max_pages, categories)
            await emit("searching", f"Found {len(results)} results from SearXNG", 1, stage="search", stages=current_stages)
            logger.info(f"Search returned {len(results)} results for '{target}'")
            _set_stage("search", "done")

            _set_stage("fetch", "active")
            page_urls = self.crawler.dedupe_urls([r.url for r in results])
            await emit("fetching", f"Fetching {len(page_urls)} pages...", 1, stage="fetch", stages=current_stages)
            pages = await self.crawler.fetch_pages(page_urls)

            fetched_count = len(pages)
            failed_count = len(page_urls) - fetched_count
            if failed_count:
                await emit("fetching", f"Fetched {fetched_count}/{len(page_urls)} pages ({failed_count} failed)", 1, stage="fetch", stages=current_stages)
            else:
                await emit("fetching", f"Fetched all {fetched_count} pages", 1, stage="fetch", stages=current_stages)
            _set_stage("fetch", "done")

            _set_stage("extract", "active")
            content_sources, skipped = await self._ingest_pages(
                pages, "page", emit, total_pages=len(pages), depth=1, stages=current_stages
            )
            if skipped:
                await emit("extracting", f"Skipped {skipped} low-quality/duplicate pages", 1, stage="extract", stages=current_stages)

            if not content_sources:
                await emit("extracting", "No pages fetched, falling back to search snippets", 1, stage="extract", stages=current_stages)
                for r in results:
                    snippet = r.snippet.strip()
                    if snippet:
                        content_sources.append(("snippet", f"{r.title}: {snippet}", [], r.url))
                        await emit("extracting", f"Using search snippet: {r.title[:60]}...", 1, stage="extract", stages=current_stages)

            await emit("extracting", f"Processing {len(content_sources)} content sources with LLM...", 1, stage="extract", stages=current_stages)

            await self._extract_batch(content_sources, target, entities, relationships, emit, depth=1)
            _set_stage("extract", "done")

            # Depth expansion
            if depth > 1:
                _set_stage("expand", "active")
                await emit("expanding", f"Expanding to depth {depth}...", 1, stage="expand", stages=current_stages)

            current_depth = 2
            while current_depth <= depth:
                # Expansion candidates: entities prominent in the current graph.
                # First prefer those mentioned >= 2x; if too few qualify (common
                # after a single extraction pass), fall back to the top-N by
                # mention_count so deeper levels still expand. Never include the
                # root target entity itself.
                target_id = self.llm._sanitize_id(target)
                candidates = [
                    e for e in entities.values()
                    if e["id"] != target_id and e["mention_count"] >= 2
                ]
                if len(candidates) < settings.max_entities_expand:
                    fallback = [
                        e for e in entities.values()
                        if e["id"] != target_id and e not in candidates
                    ]
                    candidates += sorted(
                        fallback, key=lambda e: e["mention_count"], reverse=True
                    )
                expandable = candidates[:settings.max_entities_expand]

                await emit("expanding", f"Depth {current_depth}: {len(expandable)} entities qualify for expansion", current_depth, stage="expand", stages=current_stages)

                for idx, entity in enumerate(expandable):
                    try:
                        sub_results = await self.crawler.search(entity["name"], settings.max_pages_per_entity)
                        await emit("expanding", f"Searched '{entity['name']}' → {len(sub_results)} results", current_depth, stage="expand", stages=current_stages)
                        sub_pages = await self.crawler.fetch_pages(self.crawler.dedupe_urls([r.url for r in sub_results]))

                        sub_content, sub_skipped = await self._ingest_pages(
                            sub_pages, "sub-page", emit, total_pages=len(sub_pages), depth=current_depth, stages=current_stages
                        )

                        if not sub_content:
                            for r in sub_results:
                                snippet = r.snippet.strip()
                                if snippet:
                                    sub_content.append(("snippet", f"{r.title}: {snippet}", []))

                        await self._extract_batch(sub_content, entity["name"], entities, relationships, emit, depth=current_depth)
                    except CrawlerError as e:
                        await emit("expanding", f"Failed to expand '{entity['name']}': {e}", current_depth, stage="expand", stages=current_stages)
                        continue

                    await emit("expanding", f"Expanded {entity['name']} ({idx + 1}/{len(expandable)})", current_depth, stage="expand", stages=current_stages)

                current_depth += 1

            if depth > 1:
                _set_stage("expand", "done")

            _set_stage("build", "active")
            await emit("building", f"Deduplicating {len(entities)} entities...", 1, stage="build", stages=current_stages)

            before_dedup = len(entities)
            entities = self._dedup_entities(entities, relationships)
            merged_count = before_dedup - len(entities)
            if merged_count:
                await emit("building", f"Merged {merged_count} duplicate entities via fuzzy matching", 1, stage="build", stages=current_stages)
            await emit("building", f"Rewriting {len(relationships)} relationship references...", 1, stage="build", stages=current_stages)
            relationships = self._rewrite_relationship_ids(relationships)
            before_dedup_r = len(relationships)
            relationships = self._dedup_relationships(relationships)
            dup_rels = before_dedup_r - len(relationships)
            if dup_rels:
                await emit("building", f"Deduplicated {dup_rels} duplicate relationships", 1, stage="build", stages=current_stages)

            target_id = self.llm._sanitize_id(target)
            if target_id not in entities:
                entities[target_id] = {
                    "id": target_id,
                    "name": target,
                    "type": "organization",
                    "description": f"Target entity: {target}",
                    "images": [],
                    "mention_count": 1,
                }
                await emit("building", f"Added target entity '{target}' to graph", 1, stage="build", stages=current_stages)

            if len(entities) > settings.max_entities_total:
                before_cap = len(entities)
                sorted_entities = sorted(entities.values(), key=lambda e: e["mention_count"], reverse=True)
                kept_ids = {e["id"] for e in sorted_entities[:settings.max_entities_total]}
                entities = {eid: e for eid, e in entities.items() if eid in kept_ids}
                relationships = [r for r in relationships if r["source"] in kept_ids and r["target"] in kept_ids]
                await emit("building", f"Capped entities from {before_cap} to {len(entities)} (max {settings.max_entities_total})", 1, stage="build", stages=current_stages)

            _set_stage("build", "done")
            _set_stage("done", "done")
            await emit("complete", f"Graph built: {len(entities)} entities, {len(relationships)} relationships", 1, stage="done", stages=current_stages)

            return GraphResponse(
                target=target,
                depth=depth,
                nodes=[NodeSchema(**e) for e in entities.values()],
                edges=[EdgeSchema(**r) for r in relationships],
                foundation_summary=foundation_summary,
            )

        except Exception as e:
            await emit("error", f"Build failed: {str(e)}", 1)
            logger.exception("Build failed")
            raise

    async def _ingest_pages(self, pages, label, emit, total_pages, depth, stages):
        """Filter + dedupe fetched pages into usable content sources.

        - drops pages below the minimum-content threshold (stubs/error pages)
        - drops HTTP error pages (status >= 400)
        - dedupes by normalized URL and by near-identical extracted text
        Returns (content_sources, skipped_count).
        """
        content_sources = []
        seen_texts = set()
        skipped = 0
        for i, page in enumerate(pages):
            if page.status and page.status >= 400:
                skipped += 1
                continue
            text, images = self.crawler.extract_text_and_images(page)
            if not self.crawler.is_usable_content(text):
                skipped += 1
                continue
            norm = re.sub(r"\s+", " ", text.strip()).lower()
            if norm in seen_texts:
                skipped += 1
                continue
            seen_texts.add(norm)
            content_sources.append(("page", text, images, page.url))
            if emit:
                await emit(
                    "extracting",
                    f"Extracted {len(text)} chars, {len(images)} images from {label} {i + 1}",
                    depth, stage="extract",
                    stages=stages,
                    progress=int((i + 1) / total_pages * 50) if total_pages else 0,
                )
        return content_sources, skipped

    async def _extract_batch(
        self,
        sources: list[tuple],
        target_name: str,
        entities: dict,
        relationships: list,
        emit: Callable,
        depth: int = 1,
    ) -> None:
        if not sources:
            await emit("extracting", "No content sources to process", depth, stage="extract")
            return

        texts = []
        all_images = []
        seen_img_urls = set()

        for idx, s in enumerate(sources):
            source_type = s[0]
            text = s[1]
            images = s[2] if len(s) > 2 else []
            texts.append(f"[Source {idx+1}: {source_type}]\n{text}")
            for img in images:
                img_url = img.url if hasattr(img, 'url') else img.get('url', '')
                if img_url and img_url not in seen_img_urls:
                    seen_img_urls.add(img_url)
                    all_images.append(img)

        combined_text = "\n\n".join(texts)

        logger.info("_extract_batch target=%s depth=%d sources=%d combined_len=%d", target_name, depth, len(sources), len(combined_text))
        logger.info("_extract_batch combined_text preview: %s", combined_text[:300])

        img_dicts = [
            {"url": img.url, "alt_text": img.alt_text, "context": img.context, "source_page": img.source_page}
            for img in all_images[:settings.max_images_per_call]
        ]

        await emit("extracting", f"LLM extracting from {len(sources)} sources combined ({len(combined_text)} chars, {len(all_images)} images)...", depth, stage="extract")

        try:
            new_entities, new_rels = await asyncio.wait_for(
                self.llm.extract(combined_text, target_name, img_dicts),
                timeout=180.0,
            )
            await emit("extracting", f"LLM returned {len(new_entities)} entities, {len(new_rels)} relationships from combined extraction", depth, stage="extract")
        except asyncio.TimeoutError:
            await emit("extracting", f"LLM timed out for combined extraction (180s)", depth, stage="extract")
            new_entities, new_rels = [], []
        except Exception as e:
            await emit("extracting", f"LLM failed for combined extraction: {e}", depth, stage="extract")
            new_entities, new_rels = [], []

        self._merge_entities(entities, new_entities, all_images)
        relationships.extend(new_rels)

        await emit(
            "extracting",
            f"Batch done: {len(new_entities)} new entities, {len(new_rels)} new relationships (total: {len(entities)} entities, {len(relationships)} rels)",
            depth,
            progress=100,
            entities_found=len(entities),
            relationships_found=len(relationships),
        )

    def _merge_entities(self, entities: dict, new_entities: list, images: list):
        for ne in new_entities:
            eid = ne["id"]
            if eid in entities:
                entities[eid]["mention_count"] += 1
                if ne.get("description") and len(ne.get("description", "")) > len(entities[eid].get("description", "")):
                    entities[eid]["description"] = ne["description"]
                if ne.get("foundational"):
                    entities[eid]["foundational"] = True
            else:
                ne["images"] = []
                ne["mention_count"] = 1
                ne.setdefault("foundational", False)
                entities[eid] = ne

        for img in images:
            for eid, entity in entities.items():
                if eid in img.source_page.lower() or (img.alt_text and eid.replace("_", " ") in img.alt_text.lower()):
                    img_data = {"url": img.url, "alt_text": img.alt_text, "context": img.context, "source_page": img.source_page}
                    if img_data not in entity["images"]:
                        entity["images"].append(img_data)

    _LEGAL_SUFFIXES = {"inc", "inc.", "corp", "corp.", "corporation", "co", "co.",
                       "company", "llc", "ltd", "ltd.", "limited", "group",
                       "holdings", "plc", "ag", "sa", "nv", "bv", "gb", "usa"}

    @staticmethod
    def _norm_name(name: str) -> str:
        """Normalize an entity name for deduplication: lowercase, drop legal
        suffixes/punctuation so 'Microsoft', 'Microsoft Corp' and
        'Microsoft Corporation' collapse to the same key."""
        toks = re.findall(r"[a-z0-9]+", (name or "").lower())
        toks = [t for t in toks if t not in GraphBuilder._LEGAL_SUFFIXES]
        return " ".join(toks)

    def _dedup_entities(self, entities: dict, relationships: list) -> dict:
        # Prefer the fuller name as canonical (sort by name length desc, then
        # mention count) so 'Microsoft Corporation' wins over 'Microsoft' instead
        # of whichever happened to have more mentions.
        sorted_ents = sorted(
            entities.values(),
            key=lambda e: (len(e.get("name", "")), e.get("mention_count", 0)),
            reverse=True,
        )
        canonical: dict[str, dict] = {}
        name_to_canonical: dict[str, str] = {}

        for ent in sorted_ents:
            ent_norm = self._norm_name(ent["name"])
            matched = False
            for cid, c_ent in canonical.items():
                c_norm = self._norm_name(c_ent["name"])
                ratio = SequenceMatcher(None, ent["name"].lower(), c_ent["name"].lower()).ratio()
                # Merge when: strong fuzzy match, OR normalized forms match, OR
                # one normalized name is a token-prefix of the other (handles
                # 'Microsoft' vs 'Microsoft Corporation' which score <0.80).
                prefix_match = bool(ent_norm) and bool(c_norm) and (
                    ent_norm == c_norm
                    or ent_norm.startswith(c_norm + " ")
                    or c_norm.startswith(ent_norm + " ")
                    or ent_norm.split()[0] == c_norm.split()[0]
                    and (ent_norm in c_norm or c_norm in ent_norm)
                )
                if ratio > 0.80 or prefix_match:
                    c_ent["mention_count"] += ent["mention_count"]
                    if len(ent.get("description", "")) > len(c_ent.get("description", "")):
                        c_ent["description"] = ent["description"]
                    for img in ent.get("images", []):
                        if img not in c_ent["images"]:
                            c_ent["images"].append(img)
                    name_to_canonical[ent["id"]] = cid
                    matched = True
                    break
            if not matched:
                canonical[ent["id"]] = dict(ent)
                name_to_canonical[ent["id"]] = ent["id"]

        self._merge_relationship_ids = name_to_canonical
        return canonical

    def _rewrite_relationship_ids(self, relationships: list) -> list:
        mapping = getattr(self, "_merge_relationship_ids", {})
        rewritten = []
        seen = set()
        for r in relationships:
            new_src = mapping.get(r["source"], r["source"])
            new_tgt = mapping.get(r["target"], r["target"])
            key = (new_src, new_tgt, r["type"])
            if key not in seen:
                seen.add(key)
                r["source"] = new_src
                r["target"] = new_tgt
                rewritten.append(r)
        return rewritten

    def _dedup_relationships(self, relationships: list) -> list:
        seen = set()
        unique = []
        for r in relationships:
            key = (r["source"], r["target"], r["type"])
            if key not in seen:
                seen.add(key)
                unique.append(r)
        return unique

    def to_json(self, graph: GraphResponse) -> str:
        return json.dumps(graph.model_dump(), indent=2, default=str)
