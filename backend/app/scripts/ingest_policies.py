"""Embed the policy corpus and load it into the policy_chunks table.

Re-run this any time app/data/policy_corpus.py changes — it clears and
rebuilds the table from scratch, so it's safe to run repeatedly.

    python -m app.scripts.ingest_policies
"""

from app.data.policy_corpus import POLICY_CORPUS
from app.db.database import SessionLocal
from app.models.policy_chunk import PolicyChunk
from app.services.embedding_service import embed


def ingest() -> None:
    with SessionLocal() as db:
        db.query(PolicyChunk).delete()

        embeddings = embed([chunk["text"] for chunk in POLICY_CORPUS])
        for chunk, embedding in zip(POLICY_CORPUS, embeddings):
            db.add(
                PolicyChunk(
                    category=chunk["category"],
                    clause_type=chunk["clause_type"],
                    is_core_procedure=chunk.get("is_core_procedure", False),
                    source=chunk["source"],
                    clause=chunk["clause"],
                    text=chunk["text"],
                    embedding=embedding,
                )
            )
        db.commit()
        print(f"Ingested {len(POLICY_CORPUS)} policy chunks.")


if __name__ == "__main__":
    ingest()
