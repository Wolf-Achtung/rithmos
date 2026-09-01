from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..auth import Account, current_account

router = APIRouter(prefix="/v1", tags=["coverage"])


class CoverageRecord(BaseModel):
    id: uuid.UUID
    t: datetime
    coverage: float = Field(ge=0, le=1)
    assist: int = Field(ge=0, le=3)
    device: str = Field(default="", max_length=64)


class CoverageUpload(BaseModel):
    records: list[CoverageRecord] = Field(max_length=1000)


class CoverageStored(BaseModel):
    stored: int
    total: int


class CoverageList(BaseModel):
    records: list[CoverageRecord]


@router.put("/coverage", response_model=CoverageStored)
def upload_coverage(
    body: CoverageUpload, request: Request, account: Account = Depends(current_account)
) -> CoverageStored:
    """Idempotent upload: records are keyed by their client-generated id."""
    stored = 0
    with request.app.state.pool.connection() as conn:
        for r in body.records:
            cur = conn.execute(
                "INSERT INTO coverage_records (id, account_id, device, t, coverage, assist) "
                "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                (r.id, account.id, r.device, r.t, r.coverage, r.assist),
            )
            stored += cur.rowcount
        total = conn.execute(
            "SELECT count(*) AS n FROM coverage_records WHERE account_id = %s", (account.id,)
        ).fetchone()["n"]
        conn.commit()
    return CoverageStored(stored=stored, total=int(total))


@router.get("/coverage", response_model=CoverageList)
def list_coverage(request: Request, account: Account = Depends(current_account)) -> CoverageList:
    """Every record of the account across devices, oldest first."""
    with request.app.state.pool.connection() as conn:
        rows = conn.execute(
            "SELECT id, t, coverage, assist, device FROM coverage_records WHERE account_id = %s ORDER BY t",
            (account.id,),
        ).fetchall()
    return CoverageList(records=[CoverageRecord(**row) for row in rows])
