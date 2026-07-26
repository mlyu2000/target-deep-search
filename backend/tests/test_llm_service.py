import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.fixture
def llm_service():
    from app.llm_service import LLMService
    service = LLMService()
    return service


class TestLLMService:
    def test_sanitize_id(self, llm_service):
        assert llm_service._sanitize_id("Elon Musk") == "elon_musk"
        assert llm_service._sanitize_id("Tesla, Inc.") == "tesla_inc"
        assert llm_service._sanitize_id("John's Company") == "johns_company"
        assert llm_service._sanitize_id("  Extra   Spaces  ") == "extra_spaces"
        assert len(llm_service._sanitize_id("a" * 100)) <= 50

    def test_build_prompt_contains_target(self, llm_service):
        prompt = llm_service._build_prompt("Some text about Tesla", "Tesla")
        assert "Tesla" in prompt
        assert "Some text about Tesla" in prompt

    def test_build_prompt_with_images(self, llm_service):
        images = [
            {"url": "https://example.com/img.jpg", "alt_text": "Test", "context": "Context", "source_page": "https://example.com"},
        ]
        prompt = llm_service._build_prompt("Text", "Target", images)
        assert "IMAGES ON THIS PAGE" in prompt
        assert "https://example.com/img.jpg" in prompt

    def test_build_prompt_truncates_long_text(self, llm_service):
        long_text = "x" * 20000
        prompt = llm_service._build_prompt(long_text, "Target")
        assert len(prompt) < 18000

    def test_parse_valid_response(self, llm_service):
        response = json.dumps({
            "entities": [
                {"id": "elon_musk", "name": "Elon Musk", "type": "person", "description": "CEO"},
                {"id": "tesla", "name": "Tesla", "type": "organization", "description": "Car company"},
            ],
            "relationships": [
                {"source": "elon_musk", "target": "tesla", "type": "CEO_of", "strength": 5, "description": "Elon is CEO of Tesla"},
            ],
        })
        entities, rels = llm_service._parse_response(response)
        assert len(entities) == 2
        assert len(rels) == 1
        assert entities[0]["id"] == "elon_musk"
        assert rels[0]["type"] == "CEO_of"

    def test_parse_malformed_json(self, llm_service):
        response = "{invalid json here"
        with pytest.raises(ValueError):
            llm_service._parse_response(response)

    def test_parse_empty_response(self, llm_service):
        with pytest.raises(ValueError):
            llm_service._parse_response("")

    def test_parse_response_with_extra_fields(self, llm_service):
        response = json.dumps({
            "entities": [{"id": "test", "name": "Test", "type": "person", "description": ""}],
            "relationships": [],
            "extra_field": "ignored",
        })
        entities, rels = llm_service._parse_response(response)
        assert len(entities) == 1

    def test_parse_handles_trailing_commas(self, llm_service):
        response = """{
            "entities": [{"id": "test", "name": "Test", "type": "person", "description": "",}],
            "relationships": [],
        }"""
        entities, rels = llm_service._parse_response(response)
        assert len(entities) == 1

    def test_parse_skips_malformed_entities(self, llm_service):
        response = json.dumps({
            "entities": [
                {"id": "valid", "name": "Valid", "type": "person", "description": ""},
                {"name": "No ID"},
                {},
            ],
            "relationships": [],
        })
        entities, rels = llm_service._parse_response(response)
        assert len(entities) == 2  # Now accepts entities with just name field

    def test_parse_clamps_strength(self, llm_service):
        response = json.dumps({
            "entities": [{"id": "a", "name": "A", "type": "person", "description": ""}],
            "relationships": [
                {"source": "a", "target": "b", "type": "test", "strength": 0, "description": ""},
                {"source": "a", "target": "c", "type": "test", "strength": 10, "description": ""},
            ],
        })
        entities, rels = llm_service._parse_response(response)
        assert rels[0]["strength"] == 1
        assert rels[1]["strength"] == 5

    def test_parse_fixes_invalid_type(self, llm_service):
        response = json.dumps({
            "entities": [{"id": "test", "name": "Test", "type": "alien", "description": ""}],
            "relationships": [],
        })
        entities, rels = llm_service._parse_response(response)
        assert entities[0]["type"] == "organization"

    @pytest.mark.asyncio
    async def test_extract_success(self, llm_service):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "entities": [{"id": "test", "name": "Test", "type": "person", "description": "A person"}],
            "relationships": [],
        })

        with patch.object(llm_service.client.chat.completions, "create", new=AsyncMock(return_value=mock_response)):
            entities, rels = await llm_service.extract("Some text", "Target")
            assert len(entities) == 1
            assert entities[0]["name"] == "Test"

    @pytest.mark.asyncio
    async def test_extract_empty_response(self, llm_service):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = ""

        with patch.object(llm_service.client.chat.completions, "create", new=AsyncMock(return_value=mock_response)):
            with pytest.raises(ValueError):
                await llm_service.extract("text", "target")

    @pytest.mark.asyncio
    async def test_extract_retry_on_failure(self, llm_service):
        mock = AsyncMock(side_effect=Exception("API Error"))

        with patch.object(llm_service.client.chat.completions, "create", new=mock):
            with pytest.raises(Exception):
                await llm_service.extract("text", "target")
            assert mock.call_count == 3  # initial + 2 retries

    @pytest.mark.asyncio
    async def test_extract_with_images(self, llm_service):
        images = [{"url": "https://example.com/img.jpg", "alt_text": "Logo", "context": "Company logo", "source_page": "https://example.com"}]
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "entities": [{"id": "test", "name": "Test", "type": "organization", "description": "An org"}],
            "relationships": [],
        })

        with patch.object(llm_service.client.chat.completions, "create", new=AsyncMock(return_value=mock_response)):
            entities, rels = await llm_service.extract("Some text", "Target", images)
            assert len(entities) == 1
