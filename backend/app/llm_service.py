import asyncio
import httpx
import json
import logging
import re
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """You are an entity and relationship extraction AI. Analyze the following text about "{target}".

TEXT:
{text}

{image_section}

Extract all entities (people, organizations, products, locations, technologies) mentioned in relation to "{target}".
Also extract all relationships between these entities.

Return ONLY valid JSON with this exact structure, no other text:
{{
  "entities": [
    {{"id": "unique_slug", "name": "Full Name", "type": "person|organization|product|location|technology", "description": "Brief description"}}
  ],
  "relationships": [
    {{"source": "entity_id_1", "target": "entity_id_2", "type": "relationship_type", "strength": 3, "description": "Context"}}
  ]
}}

Rules:
1. Entity IDs: lowercase, underscores, max 50 chars
2. Relationship types: founded|acquired|partnered|competes|invested_in|supplies|employs|regulates|collaborates_with|owns|subsidiary_of|located_in|developed|uses
3. Strength: 1 (weak mention) to 5 (direct, well-documented relationship)
4. Only include well-supported relationships with evidence in the text
5. Extract as many entities as possible — aim for at least 10 entities per response
6. Do not include entities that are not related to the target
"""


class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            http_client=httpx.AsyncClient(verify=False),
        )
        self.model = settings.openai_model
        self.timeout = settings.llm_request_timeout

    def _sanitize_id(self, name: str) -> str:
        sanitized = re.sub(r"[^a-zA-Z0-9\s_]", "", name)
        sanitized = sanitized.strip().lower().replace(" ", "_")
        sanitized = re.sub(r"_+", "_", sanitized)
        return sanitized[:50]

    def _build_prompt(self, text: str, target: str, images: list = None) -> str:
        image_section = ""
        if images:
            image_list = "\n".join(
                f"- URL: {img.get('url', '')} | Alt: {img.get('alt_text', '')} | Context: {img.get('context', '')}"
                for img in images[:settings.max_images_per_call]
            )
            image_section = f"IMAGES ON THIS PAGE:\n{image_list}\n\nFor each image, identify entities shown (people, logos, products, locations) and any relationships implied."

        safe_text = text[:8000].replace("{", "{{").replace("}", "}}")
        return EXTRACTION_PROMPT.format(
            target=target,
            text=safe_text,
            image_section=image_section,
        )

    def _parse_response(self, response_text: str) -> tuple[list, list]:
        text = response_text.strip()

        # Strip reasoning prefix: find the first JSON object or array
        json_match = re.search(r"[\{\[]", text)
        if json_match:
            text = text[json_match.start():]

        # Match balanced JSON object
        brace_match = re.search(r"\{[\s\S]*\}", text)
        if brace_match:
            text = brace_match.group()
        else:
            bracket_match = re.search(r"\[[\s\S]*\]", text)
            if bracket_match:
                text = bracket_match.group()
            else:
                raise ValueError("No JSON found in LLM response")

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            pos = exc.pos
            snippet = text[max(0, pos - 40):pos + 40]
            logger.warning("_parse_response json.loads failed at pos %d around: ...%s...", pos, snippet)
            try:
                decoder = json.JSONDecoder()
                data, _ = decoder.raw_decode(text)
                logger.info("_parse_response raw_decode succeeded after first failure")
            except json.JSONDecodeError:
                try:
                    # Try cleaning trailing garbage before the final } and retry
                    for trim in range(len(text) - 1, 0, -1):
                        try:
                            decoder = json.JSONDecoder()
                            data, _ = decoder.raw_decode(text[:trim])
                            logger.info("_parse_response progressive trim succeeded at len %d", trim)
                            break
                        except json.JSONDecodeError:
                            continue
                    else:
                        raise
                except Exception:
                    # Final fallback: remove trailing comma before } or ]
                    cleaned = re.sub(r",\s*}", "}", text)
                    cleaned = re.sub(r",\s*\]", "]", cleaned)
                    try:
                        data = json.loads(cleaned)
                    except json.JSONDecodeError as exc2:
                        pos2 = exc2.pos
                        snippet2 = cleaned[max(0, pos2 - 40):pos2 + 40]
                        logger.warning("_parse_response fallback also failed at pos %d around: ...%s...", pos2, snippet2)
                        raise ValueError(f"Failed to parse LLM response as JSON at pos {pos}: ...{snippet}...")

        if isinstance(data, list):
            raw_entities = data
            raw_relationships = []
        else:
            raw_entities = data.get("entities") or data.get("nodes") or data.get("items") or []
            raw_relationships = data.get("relationships") or data.get("edges") or data.get("relations") or []

        entities = []
        relationships = []
        for item in raw_entities:
            if item.get("source") or item.get("target") or item.get("subject"):
                relationships.append(item)
            else:
                entities.append(item)
        for item in raw_relationships:
            relationships.append(item)

        TYPE_MAP = {
            "city": "location", "state": "location", "country": "location",
            "place": "location", "location": "location",
            "person": "person", "people": "person",
            "organization": "organization", "company": "organization", "org": "organization",
            "gpe": "location", "loc": "location",
            "product": "product", "technology": "technology",
        }

        validated_entities = []
        for e in entities:
            name = e.get("name") or e.get("entity") or e.get("text") or e.get("id")
            if not name:
                continue
            eid = e.get("id") or name
            e_id = self._sanitize_id(eid)
            e_type = TYPE_MAP.get(e.get("type", "").lower().strip(), "organization")
            validated_entities.append({"id": e_id, "name": name, "type": e_type, "description": e.get("description", "")})

        validated_relationships = []
        for r in relationships:
            src = r.get("source") or r.get("subject") or r.get("from")
            tgt = r.get("target") or r.get("object") or r.get("to")
            if not src or not tgt:
                continue
            r_type = r.get("type") or r.get("predicate") or r.get("relation") or "related_to"
            validated_relationships.append({
                "source": self._sanitize_id(src),
                "target": self._sanitize_id(tgt),
                "type": r_type,
                "strength": max(1, min(5, r.get("strength", 3))),
                "description": r.get("description", ""),
            })

        return validated_entities, validated_relationships

    async def extract(self, text: str, target: str, images: list = None) -> tuple[list, list]:
        prompt = self._build_prompt(text, target, images)

        logger.info("extract target=%s text_len=%d prompt_len=%d", target, len(text), len(prompt))

        max_retries = 2
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a precise entity and relationship extraction engine. Always respond with ONLY valid JSON. No thinking, no reasoning."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=8192,
                    timeout=self.timeout,
                )

                content = response.choices[0].message.content
                if not content:
                    raise ValueError("Empty LLM response")

                logger.info("extract attempt %d: %d chars response", attempt + 1, len(content))

                return self._parse_response(content)

            except ValueError as e:
                last_error = e
                logger.warning("extract attempt %d failed for target=%s: %s", attempt + 1, target, e)
                if "Empty LLM response" in str(e) and len(text) > 3000:
                    logger.info("empty response, retrying with shorter text (%d -> 3000 chars)", len(text))
                    return await self.extract(text[:3000], target, images)
                if attempt < max_retries:
                    delay = 5 + attempt * 15
                    logger.info("retrying attempt %d in %ds", attempt + 2, delay)
                    await asyncio.sleep(delay)
                    continue

            except Exception as e:
                last_error = e
                logger.warning("extract attempt %d failed for target=%s: %s", attempt + 1, target, e)
                if attempt < max_retries:
                    await asyncio.sleep(5)
                    continue

        raise last_error
