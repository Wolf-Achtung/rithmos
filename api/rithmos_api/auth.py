"""Anonymous accounts: a random bearer token per account, stored as a SHA-256 hash."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer(auto_error=False)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Account:
    id: uuid.UUID


def current_account(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Account:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    pool = request.app.state.pool
    with pool.connection() as conn:
        row = conn.execute(
            "UPDATE accounts SET last_seen_at = now() WHERE token_hash = %s RETURNING id",
            (token_hash(credentials.credentials),),
        ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown token")
    return Account(id=row["id"])


def require_jobs_token(request: Request) -> None:
    expected = request.app.state.settings.jobs_token
    given = request.headers.get("x-jobs-token")
    if not expected or given is None or not secrets.compare_digest(given, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "jobs token required")
