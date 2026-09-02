"""The Middles form of the coverage metric (CLAUDE.md 7): one record per finished
puzzle, synced across the devices of an account. The hit rate itself is computed
on the device; the server only keeps the records."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..auth import Account, current_account

router = APIRouter(prefix="/v1", tags=["middles"])


class MiddlesResult(BaseModel):
    """Mirrors SkillRecord in app/src/middles/skill.ts."""

    id: str = Field(min_length=1, max_length=64)
    t: datetime
    mode: Literal["daily", "practice"]
    level: int = Field(ge=0, le=9)
    kind: Literal["arithmetic", "geometric", "musical"]
    solved: bool
    tries: int = Field(ge=1, le=99)
    cents: float | None = Field(default=None, ge=-2400, le=2400)
    device: str = Field(default="", max_length=64)


class ResultsUpload(BaseModel):
    records: list[MiddlesResult] = Field(max_length=1000)


class ResultsStored(BaseModel):
    stored: int
    total: int


class ResultsList(BaseModel):
    records: list[MiddlesResult]


@router.put("/middles/results", response_model=ResultsStored)
def upload_results(body: ResultsUpload, request: Request, account: Account = Depends(current_account)) -> ResultsStored:
    """Idempotent upload: records are keyed by their client id within the account."""
    stored = 0
    with request.app.state.pool.connection() as conn:
        for r in body.records:
            cur = conn.execute(
                "INSERT INTO middles_results (id, account_id, device, t, mode, level, kind, solved, tries, cents) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (account_id, id) DO NOTHING",
                (r.id, account.id, r.device, r.t, r.mode, r.level, r.kind, r.solved, r.tries, r.cents),
            )
            stored += cur.rowcount
        total = conn.execute(
            "SELECT count(*) AS n FROM middles_results WHERE account_id = %s", (account.id,)
        ).fetchone()["n"]
        conn.commit()
    return ResultsStored(stored=stored, total=int(total))


@router.get("/middles/results", response_model=ResultsList)
def list_results(request: Request, account: Account = Depends(current_account)) -> ResultsList:
    """Every record of the account across devices, oldest first."""
    with request.app.state.pool.connection() as conn:
        rows = conn.execute(
            "SELECT id, t, mode, level, kind, solved, tries, cents, device FROM middles_results "
            "WHERE account_id = %s ORDER BY t, id",
            (account.id,),
        ).fetchall()
    return ResultsList(records=[MiddlesResult(**row) for row in rows])
