from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    openai_api_key: str = "not-needed"
    openai_base_url: str = "http://localhost:9000/v1"
    openai_model: str = "qwen3.5-4b"
    searxng_url: str = "http://localhost:8888"
    database_url: str = "sqlite+aiosqlite:///./graphs.db"
    max_concurrent_fetches: int = 5
    max_pages_per_depth: int = 10
    max_pages_per_entity: int = 5
    max_entities_expand: int = 5
    max_entities_total: int = 200
    max_images_per_call: int = 5
    llm_request_timeout: int = 180
    crawl_request_timeout: int = 30
    analysis_timeout: int = 1800
    max_extract_chars: int = 30000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
