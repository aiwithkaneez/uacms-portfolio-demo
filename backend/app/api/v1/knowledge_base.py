from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.auth import require_role
from app.models.policy_chunk import PolicyChunk
from app.models.user import User
from app.schemas.knowledge_base import PolicyChunkCreateRequest, PolicyChunkItem, PolicyChunkUpdateRequest
from app.services.embedding_service import embed_one

router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])
DbSession = Annotated[Session, Depends(get_db)]
KbAdmin = Annotated[User, Depends(require_role("Knowledge Base Admin"))]


def _to_item(chunk: PolicyChunk) -> PolicyChunkItem:
    return PolicyChunkItem(
        id=chunk.id,
        category=chunk.category,
        clause=chunk.clause,
        source=chunk.source,
        text=chunk.text,
        clause_type=chunk.clause_type,
        is_core_procedure=chunk.is_core_procedure,
    )


@router.get("/policies", response_model=list[PolicyChunkItem])
def list_policy_chunks(db: DbSession, _current_user: KbAdmin) -> list[PolicyChunkItem]:
    """The actual policy corpus the AI Recommendation Engine retrieves from -
    what the Knowledge Base Admin role exists to look after. Gated to KB
    Admin specifically, not shared with Executive (see suggestion_service.py
    and app/data/policy_corpus.py for how this corpus is actually used).
    """
    chunks = db.scalars(select(PolicyChunk).order_by(PolicyChunk.category, PolicyChunk.id)).all()
    return [_to_item(chunk) for chunk in chunks]


@router.post("/policies", response_model=PolicyChunkItem, status_code=status.HTTP_201_CREATED)
def create_policy_chunk(payload: PolicyChunkCreateRequest, db: DbSession, _current_user: KbAdmin) -> PolicyChunkItem:
    """Add a new policy clause to the corpus — e.g. after a sample policy
    document changes. Embedded immediately on save so it's retrievable by
    the suggestion engine right away, same embedding space as everything
    ingested via app/scripts/ingest_policies.py (fastembed,
    sentence-transformers/all-MiniLM-L6-v2).
    """
    chunk = PolicyChunk(
        category=payload.category,
        clause=payload.clause,
        source=payload.source,
        text=payload.text,
        clause_type=payload.clause_type,
        is_core_procedure=payload.is_core_procedure,
        embedding=embed_one(payload.text),
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    return _to_item(chunk)


@router.patch("/policies/{chunk_id}", response_model=PolicyChunkItem)
def update_policy_chunk(
    chunk_id: int,
    payload: PolicyChunkUpdateRequest,
    db: DbSession,
    _current_user: KbAdmin,
) -> PolicyChunkItem:
    """Update an existing clause — e.g. the bank revised a policy's wording
    or timeline. Re-embeds only when `text` actually changed; every other
    field is metadata the embedding doesn't depend on.
    """
    chunk = db.scalar(select(PolicyChunk).where(PolicyChunk.id == chunk_id))
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy chunk not found")

    updates = payload.model_dump(exclude_unset=True)
    text_changed = "text" in updates and updates["text"] != chunk.text

    for field, value in updates.items():
        setattr(chunk, field, value)

    if text_changed:
        chunk.embedding = embed_one(chunk.text)

    db.commit()
    db.refresh(chunk)
    return _to_item(chunk)
