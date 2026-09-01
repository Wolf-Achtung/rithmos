from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..auth import Account, current_account, new_token, token_hash

router = APIRouter(prefix="/v1", tags=["accounts"])


class NewAccount(BaseModel):
    account_id: str
    token: str


class Me(BaseModel):
    account_id: str
    created_at: str
    coverage_records: int


@router.post("/accounts", response_model=NewAccount, status_code=201)
def create_account(request: Request) -> NewAccount:
    """Create an anonymous account. The token is returned once and never stored in clear."""
    token = new_token()
    with request.app.state.pool.connection() as conn:
        row = conn.execute(
            "INSERT INTO accounts (token_hash) VALUES (%s) RETURNING id", (token_hash(token),)
        ).fetchone()
        conn.commit()
    return NewAccount(account_id=str(row["id"]), token=token)


@router.get("/me", response_model=Me)
def me(request: Request, account: Account = Depends(current_account)) -> Me:
    with request.app.state.pool.connection() as conn:
        row = conn.execute(
            "SELECT a.created_at, (SELECT count(*) FROM coverage_records c WHERE c.account_id = a.id) AS n "
            "FROM accounts a WHERE a.id = %s",
            (account.id,),
        ).fetchone()
    return Me(account_id=str(account.id), created_at=row["created_at"].isoformat(), coverage_records=int(row["n"]))
