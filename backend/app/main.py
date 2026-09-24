from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, complaints, health, knowledge_base, public_complaints, users
from app.core.config import get_settings

app = FastAPI(title="UACMS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
# Registered before complaints.router: its /complaints/public/* routes are
# POST-only and static-shaped, so they can't actually collide with
# complaints.router's GET /complaints/{complaint_id} - registered first
# anyway as a deliberate safety margin, matching this codebase's existing
# caution around route-shadowing (see complaints.py's own comments on it).
app.include_router(public_complaints.router, prefix="/api/v1")
app.include_router(complaints.router, prefix="/api/v1")
app.include_router(knowledge_base.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
