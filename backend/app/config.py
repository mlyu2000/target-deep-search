from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    openai_api_key: str
    openai_base_url: str = "https://opencode.ai/zen/v1"
    openai_model: str = "deepseek-v4-flash-free"
    searxng_url: str = "http://searxng:8080"
    database_url: str = "sqlite+aiosqlite:///./graphs.db"
    max_concurrent_fetches: int = 5
    max_pages_per_depth: int = 10
    max_pages_per_entity: int = 5
    max_entities_expand: int = 5
    max_entities_total: int = 50
    max_images_per_call: int = 5
    llm_request_timeout: int = 180
    crawl_request_timeout: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
