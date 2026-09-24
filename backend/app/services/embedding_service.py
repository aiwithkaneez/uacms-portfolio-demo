from functools import lru_cache

# Same model as before (sentence-transformers/all-MiniLM-L6-v2), but loaded
# via fastembed (ONNX runtime) instead of sentence-transformers (PyTorch).
# This is not a cosmetic swap: on Render's free tier (512MB RAM), loading
# the PyTorch version alone measured ~450MB RSS - right at the ceiling
# before the rest of the app (FastAPI, SQLAlchemy, FAISS) even loads, and
# in production this crashed the entire process, not just the suggestion
# request that triggered it. The ONNX version of the identical model
# measured ~175MB. Embedding output (384-dim, pre-normalized) is unchanged,
# so retrieval quality and the calibrated confidence thresholds carry over.
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def _get_model():
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=MODEL_NAME)


def embed(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Loads the model lazily on first use."""
    model = _get_model()
    return [vector.tolist() for vector in model.embed(texts)]


def embed_one(text: str) -> list[float]:
    return embed([text])[0]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    # Embeddings are already normalized (unit length), so cosine similarity
    # reduces to a plain dot product.
    return sum(x * y for x, y in zip(a, b))


def faiss_search(query_embedding: list[float], candidate_embeddings: list[list[float]]) -> list[float]:
    """Cosine-similarity search via FAISS, returning a score per candidate in
    input order (not re-sorted — callers already sort/rank downstream).

    Embeddings are pre-normalized (see embed()), so an inner-product index
    (IndexFlatIP) gives the same score as cosine_similarity()'s dot product —
    this only changes *how* the search is computed, not the ranking math.
    At this project's corpus size (a few dozen chunks per category) FAISS
    has no real speed advantage over the plain Python loop it replaces; it's
    used here to match the retrieval architecture as specified, not because
    the corpus is large enough to need approximate-neighbor search.
    """
    import numpy as np
    import faiss

    if not candidate_embeddings:
        return []

    vectors = np.array(candidate_embeddings, dtype="float32")
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)

    query = np.array([query_embedding], dtype="float32")
    scores, indices = index.search(query, len(candidate_embeddings))

    score_by_index = dict(zip(indices[0].tolist(), scores[0].tolist()))
    return [score_by_index[i] for i in range(len(candidate_embeddings))]
