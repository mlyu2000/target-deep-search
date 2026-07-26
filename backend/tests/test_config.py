import os
import pytest


class TestConfig:
    def test_load_config_from_env(self):
        from app.config import settings
        assert settings.openai_api_key == "test-key"
        assert settings.searxng_url == "http://test-searxng:8080"
        assert settings.openai_base_url == "https://test-api.example.com/v1"
        assert settings.openai_model == "test-model"

    def test_default_values(self):
        from app.config import Settings
        s = Settings(
            openai_api_key="key",
            searxng_url="http://searxng:8080",
            database_url="sqlite+aiosqlite:///./test.db",
        )
        assert s.max_concurrent_fetches == 5
        assert s.max_pages_per_depth == 10
        assert s.max_entities_total == 50
        assert s.llm_request_timeout == 180

    def test_key_from_env_is_required(self):
        """OPENAI_API_KEY must be set (from env or .env file)."""
        from app.config import Settings
        s = Settings(
            _env_file=None,
            openai_api_key=os.environ.get("OPENAI_API_KEY", "fallback-key"),
            searxng_url="http://searxng:8080",
            database_url="sqlite+aiosqlite:///./test.db",
        )
        assert s.openai_api_key is not None
