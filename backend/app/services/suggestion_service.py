from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data.action_knowledge_base import get_recommended_workflow
from app.models.policy_chunk import PolicyChunk
from app.services.embedding_service import embed_one, faiss_search

# Calibrated against all-MiniLM-L6-v2 cosine similarity scores on this
# project's actual policy corpus + realistic complaint text (see
# scratchpad test during development) — informal complaint phrasing vs.
# formal policy language scores much lower than the BRD's 85%/60%
# thresholds assume, since those numbers were written for a fine-tuned
# domain model, not a general-purpose one. Not a universal constant —
# re-check if the corpus or model changes materially.
CONFIDENCE_THRESHOLDS = [
    (0.30, "green"),
    (0.20, "amber"),
    (0.10, "red"),
]
TOP_K = 3

# Categories with a sample policy corpus to check a complaint's wording
# against. "general" has none (see get_suggestions), so it can never be the
# selected category's own score, but it can still be flagged as a *better*
# fit if the complaint text scores green against one of these three.
CATEGORIES_WITH_CORPUS = ["harassment", "whistleblow", "grievance"]

WHY_MATCHED = {
    "conduct": "This clause describes the type of conduct your complaint involves.",
    "process": "This clause describes part of the process for handling this type of complaint.",
    "process_guaranteed": (
        "This is the standard procedure for handling this category of complaint — shown "
        "regardless of exact wording match, since it's the core process a desk owner needs "
        "to follow."
    ),
}


def _confidence_level(score: float) -> str:
    for threshold, level in CONFIDENCE_THRESHOLDS:
        if score >= threshold:
            return level
    return "none"


def get_suggestions(db: Session, category: str, description: str) -> dict:
    """Policy-based suggestions for this complaint's category: retrieval-only,
    no generation. Returns a dict with `suggestions` (top policy chunks,
    ranked by similarity) and `recommended_workflow` (a short, human-authored
    "next steps" checklist paraphrased from the same sample policy text —
    labeled "Recommended System Workflow", never claimed as a verbatim
    policy quote; see app/data/action_knowledge_base.py).

    Both are empty for categories with no policy corpus (e.g. "general" —
    operational complaints aren't covered by an HR policy). That's shown to
    the desk owner as "no procedure found", not papered over with an
    invented generic workflow — the same reasoning that keeps this engine
    retrieval-only in the first place: don't claim a policy says something
    it doesn't.

    Guarantees a procedural clause (how to actually handle the case —
    investigation steps, timelines, escalation) is included in `suggestions`,
    even if it wouldn't naturally place in the top-K by raw similarity.
    Complaint text describes an incident, which semantically matches
    "conduct" clauses (definitions, manifestations) far better than
    "process" clauses (administrative/procedural language) — so a desk
    owner could see three "here's what this is" results and never the
    "here's what to do about it" result, which is the one they actually
    need to act.

    Where the category has a clause marked `is_core_procedure` (its actual
    handling procedure — who investigates, what deadlines apply), that
    specific clause is guaranteed, not just any process clause: testing
    showed "any process clause" could surface something real but tangential
    (e.g. "Rewards" for whistleblow) instead of the one that actually tells
    the desk owner what to do. Categories without a marked core-procedure
    clause (grievance — its process is inherently staged and already
    surfaces a relevant stage naturally) fall back to guaranteeing any
    process clause. See app/data/policy_corpus.py for the full rationale.
    """
    chunks = db.scalars(select(PolicyChunk).where(PolicyChunk.category == category)).all()
    if not chunks:
        return {"suggestions": [], "recommended_workflow": []}

    query_embedding = embed_one(description)
    scores = faiss_search(query_embedding, [chunk.embedding for chunk in chunks])
    scored = [
        {
            "source": chunk.source,
            "clause": chunk.clause,
            "text": chunk.text,
            "clause_type": chunk.clause_type,
            "is_core_procedure": chunk.is_core_procedure,
            "score": score,
        }
        for chunk, score in zip(chunks, scores)
    ]
    scored.sort(key=lambda item: item["score"], reverse=True)

    top = scored[:TOP_K]

    core_procedure = next((item for item in scored if item["is_core_procedure"]), None)
    if core_procedure is not None:
        guaranteed = core_procedure if not any(item["is_core_procedure"] for item in top) else None
    elif not any(item["clause_type"] == "process" for item in top):
        guaranteed = max(
            (item for item in scored if item["clause_type"] == "process"),
            key=lambda item: item["score"],
            default=None,
        )
    else:
        guaranteed = None

    if guaranteed is not None and top:
        top[-1] = guaranteed
        top.sort(key=lambda item: item["score"], reverse=True)

    # A guaranteed clause is shown because it's structurally always
    # relevant (the standard applicable procedure), not because its wording
    # happens to overlap with this complaint — so its raw score can compute
    # to "none" even though it's a real, deliberately-included suggestion.
    # Displaying "No Match" next to content we're guaranteeing as relevant
    # would tell the desk owner to disregard exactly what they most need to
    # see, so floor a guaranteed clause's confidence at "red" (still an
    # honest "low similarity to your specific wording", not a false claim
    # of a strong match).
    guaranteed_clause = guaranteed["clause"] if guaranteed is not None else None
    for item in top:
        confidence = _confidence_level(item["score"])
        is_guaranteed = item["clause"] == guaranteed_clause
        if is_guaranteed and confidence == "none":
            confidence = "red"
        item["confidence"] = confidence
        item["why_matched"] = WHY_MATCHED["process_guaranteed"] if is_guaranteed else WHY_MATCHED[item["clause_type"]]
        item["is_guaranteed"] = is_guaranteed

    return {"suggestions": top, "recommended_workflow": get_recommended_workflow(category)}


def check_category_mismatch(db: Session, selected_category: str, description: str) -> dict | None:
    """Soft, non-blocking check: does this complaint's wording match a
    *different* category's policy corpus clearly better than the one the
    employee picked?

    Deliberately not a classifier and deliberately not a submission gate —
    this project's AI categorization is manual selection by design (see
    the original project design), specifically because an automatic categorizer
    would sometimes be wrong, and being wrong on a Harassment or Whistleblow
    complaint by refusing to register it is a real harm, not a UX nitpick.
    This function only ever produces a suggestion the caller can show as a
    dismissible warning; it never determines whether a complaint gets saved.

    Returns None unless another category scores "green" (high confidence)
    AND the selected category does not — i.e. only when there's a strong
    signal for something else and a weak signal for the current pick. Two
    green-confidence categories, or two weak ones, both return None: the
    signal isn't clear enough either way to be worth interrupting the user.
    """
    query_embedding = embed_one(description)

    best_by_category: dict[str, float] = {}
    for category in CATEGORIES_WITH_CORPUS:
        chunks = db.scalars(select(PolicyChunk).where(PolicyChunk.category == category)).all()
        if not chunks:
            continue
        scores = faiss_search(query_embedding, [chunk.embedding for chunk in chunks])
        best_by_category[category] = max(scores) if scores else 0.0

    selected_confidence = _confidence_level(best_by_category.get(selected_category, 0.0))

    other_scores = {c: s for c, s in best_by_category.items() if c != selected_category}
    if not other_scores:
        return None

    best_other_category = max(other_scores, key=lambda c: other_scores[c])
    best_other_confidence = _confidence_level(other_scores[best_other_category])

    if best_other_confidence == "green" and selected_confidence != "green":
        return {"suggested_category": best_other_category, "confidence": best_other_confidence}
    return None
