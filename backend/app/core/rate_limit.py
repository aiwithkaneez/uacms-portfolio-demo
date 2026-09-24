import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

# In-memory, per-process rate limiting — no Redis/external service in this
# deployment. Resets on restart (Render free tier can restart the instance
# at any time), which is fine: this is meant to stop naive spam/flooding on
# the public no-login endpoints, not survive a determined attacker.
_request_log: dict[str, list[float]] = defaultdict(list)

WINDOW_SECONDS = 3600
MAX_REQUESTS_PER_WINDOW = 5


def _client_ip(request: Request) -> str:
    # Render sits behind a proxy — the real client IP is the first entry in
    # X-Forwarded-For, not request.client.host (that's the proxy itself).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_public_endpoint(request: Request) -> None:
    ip = _client_ip(request)
    now = time.monotonic()
    recent = [t for t in _request_log[ip] if now - t < WINDOW_SECONDS]

    if len(recent) >= MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    recent.append(now)
    _request_log[ip] = recent
