import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["SEARXNG_URL"] = "http://test-searxng:8080"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["OPENAI_BASE_URL"] = "https://test-api.example.com/v1"
os.environ["OPENAI_MODEL"] = "test-model"

from app.database import Base
from app.models import Session as SessionModel
from app.schemas import (
    BuildRequest, GraphResponse, NodeSchema, EdgeSchema,
    ImageSchema, SessionSchema, SessionListResponse, StatusUpdate
)


TEST_DB_URL = "sqlite+aiosqlite:///./test.db"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session_local = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_local() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def test_session_data():
    import uuid
    from datetime import datetime
    return {
        "id": str(uuid.uuid4()),
        "target": "test_target",
        "depth": 2,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "graph_data": None,
    }


@pytest.fixture
def sample_graph_data():
    return {
        "nodes": [
            {"id": "entity_a", "name": "Entity A", "type": "person", "description": "Test person", "images": [], "mention_count": 3},
            {"id": "entity_b", "name": "Entity B", "type": "organization", "description": "Test org", "images": [], "mention_count": 2},
        ],
        "edges": [
            {"source": "entity_a", "target": "entity_b", "type": "founded", "strength": 4, "description": "A founded B", "source_urls": ["https://example.com"]}
        ],
        "target": "test_target",
        "depth": 1,
    }


@pytest.fixture
def mock_search_results():
    return [
        {
            "title": "Test Result 1",
            "url": "https://example.com/page1",
            "content": "This is a snippet about the target entity.",
            "thumbnail": "https://example.com/img1.jpg",
        },
        {
            "title": "Test Result 2",
            "url": "https://example.com/page2",
            "content": "More content about the target.",
            "img_src": "https://example.com/img2.jpg",
        },
    ]


@pytest.fixture
def mock_page_html():
    return """
    <html>
    <body>
        <h1>Target Entity Page</h1>
        <p>The target entity was founded by John Doe in 2010.</p>
        <img src="https://example.com/logo.png" alt="Target Entity Logo">
        <figure>
            <img data-src="https://example.com/team.jpg" alt="Team photo">
            <figcaption>The founding team</figcaption>
        </figure>
        <p>Today, Target Corp works closely with Partner Inc on AI research.</p>
        <img src="https://example.com/office.jpg">
    </body>
    </html>
    """


@pytest.fixture
def mock_llm_response():
    return {
        "entities": [
            {"id": "john_doe", "name": "John Doe", "type": "person", "description": "Founder of Target Corp"},
            {"id": "target_corp", "name": "Target Corp", "type": "organization", "description": "A technology company"},
            {"id": "partner_inc", "name": "Partner Inc", "type": "organization", "description": "A research partner"},
        ],
        "relationships": [
            {"source": "john_doe", "target": "target_corp", "type": "founded", "strength": 5, "description": "John Doe founded Target Corp in 2010"},
            {"source": "target_corp", "target": "partner_inc", "type": "partners", "strength": 3, "description": "Target Corp partners with Partner Inc on AI"},
        ],
    }
