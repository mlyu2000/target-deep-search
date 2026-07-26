import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    target = Column(String, nullable=False)
    depth = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="pending")
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    graph_data = Column(Text, nullable=True)
    report_type = Column(String, nullable=True, default="graph")
