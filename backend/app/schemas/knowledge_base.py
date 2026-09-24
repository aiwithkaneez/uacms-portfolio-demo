from pydantic import BaseModel, Field


class PolicyChunkItem(BaseModel):
    id: int
    category: str
    clause: str
    source: str
    text: str
    clause_type: str
    is_core_procedure: bool


class PolicyChunkCreateRequest(BaseModel):
    category: str = Field(pattern="^(general|grievance|harassment|whistleblow)$")
    clause: str = Field(min_length=1, max_length=255)
    source: str = Field(min_length=1, max_length=255)
    text: str = Field(min_length=10, max_length=5000)
    clause_type: str = Field(pattern="^(conduct|process)$")
    is_core_procedure: bool = False


class PolicyChunkUpdateRequest(BaseModel):
    """All fields optional — a partial update. `text` changing is what
    actually matters operationally: it means the embedding this chunk was
    retrieved by is now stale and must be recomputed (see
    app/api/v1/knowledge_base.py), everything else is just metadata.
    """

    category: str | None = Field(default=None, pattern="^(general|grievance|harassment|whistleblow)$")
    clause: str | None = Field(default=None, min_length=1, max_length=255)
    source: str | None = Field(default=None, min_length=1, max_length=255)
    text: str | None = Field(default=None, min_length=10, max_length=5000)
    clause_type: str | None = Field(default=None, pattern="^(conduct|process)$")
    is_core_procedure: bool | None = None
