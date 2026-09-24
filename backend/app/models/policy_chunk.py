from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class PolicyChunk(Base):
    """A single retrievable excerpt from the policy corpus, embedded for similarity search.

    Searched only within its own category — this is what gives the suggestion
    engine cross-category isolation (a Harassment complaint's embedding is
    only ever compared against Harassment policy chunks).
    """

    __tablename__ = "policy_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    clause_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_core_procedure: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    clause: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(ARRAY(Float), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
