from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from datetime import datetime


class ImageSchema(BaseModel):
    url: str
    alt_text: Optional[str] = None
    context: Optional[str] = None
    source_page: str


class NodeSchema(BaseModel):
    id: str
    name: str
    type: Literal["person", "organization", "product", "location", "technology"]
    description: str = ""
    images: list[ImageSchema] = []
    mention_count: int = 1


class EdgeSchema(BaseModel):
    source: str
    target: str
    type: str
    strength: int = Field(default=3, ge=1, le=5)
    description: str = ""
    source_urls: list[str] = []


VALID_CATEGORIES = {"general", "images", "news", "videos", "blogs", "social_media", "it", "science", "files"}


class BuildRequest(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    depth: int = Field(default=2, ge=1, le=4)
    max_pages: int = Field(default=10, ge=1, le=30)
    categories: Optional[list[str]] = None

    @field_validator("target")
    @classmethod
    def target_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Target cannot be empty")
        return stripped

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v:
            invalid = set(v) - VALID_CATEGORIES
            if invalid:
                raise ValueError(f"Invalid categories: {invalid}. Valid: {VALID_CATEGORIES}")
        return v


class AnalyzeRequest(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    depth: int = Field(default=2, ge=1, le=4)
    mode: Literal["graph", "competitive", "supplychain"] = "graph"
    max_pages: int = Field(default=10, ge=1, le=30)
    categories: Optional[list[str]] = None


class BuildResponse(BaseModel):
    task_id: str


class GraphResponse(BaseModel):
    target: str
    depth: int
    nodes: list[NodeSchema]
    edges: list[EdgeSchema]
    error: Optional[str] = None
    report: Optional[dict] = None
    report_type: Optional[str] = None


class StageInfo(BaseModel):
    name: str
    status: Literal["pending", "active", "done", "error"]
    started_at: Optional[str] = None
    elapsed: Optional[float] = None


class StatusUpdate(BaseModel):
    status: str
    message: str
    depth: int = 1
    progress: Optional[int] = None
    entities_found: Optional[int] = None
    relationships_found: Optional[int] = None
    stage: Optional[str] = None
    stages: Optional[list[StageInfo]] = None


class SessionSchema(BaseModel):
    id: str
    target: str
    depth: int
    status: str
    error_msg: Optional[str] = None
    report_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    sessions: list[SessionSchema]
