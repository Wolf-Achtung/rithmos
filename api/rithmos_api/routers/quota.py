"""What is left today, per feature, so the app can say it before the first try."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..auth import Account, current_account
from ..quota import FEATURES, remaining

router = APIRouter(prefix="/v1", tags=["quota"])


class FeatureQuota(BaseModel):
    limit: int
    remaining: int


@router.get("/quota", response_model=dict[str, FeatureQuota])
def quota(request: Request, account: Account = Depends(current_account)) -> dict[str, FeatureQuota]:
    with request.app.state.pool.connection() as conn:
        return {f.name: FeatureQuota(limit=f.per_day, remaining=remaining(conn, account.id, f)) for f in FEATURES}
