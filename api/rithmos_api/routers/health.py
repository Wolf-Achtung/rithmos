from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
def health(request: Request) -> dict:
    pool = request.app.state.pool
    with pool.connection() as conn:
        row = conn.execute("SELECT coalesce(max(version), 0) AS v FROM schema_migrations").fetchone()
    return {"ok": True, "schema_version": int(row["v"])}
