"""The hunt (Zug F): a photo goes to the vision model, which only counts. What
comes back are names and numbers; the engine in the app looks for the means
among them. Capped per account and per day; without a key the endpoint is 404."""

from __future__ import annotations

import base64
import logging
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..auth import Account, current_account
from ..llm import HuntGroup, clean_counts
from ..quota import HUNT, require

router = APIRouter(prefix="/v1", tags=["hunt"])
log = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 3_000_000


class HuntIn(BaseModel):
    media_type: Literal["image/jpeg", "image/png", "image/webp"]
    image: str = Field(min_length=100, max_length=4_200_000)
    """base64 without a data: prefix"""


class HuntOut(BaseModel):
    groups: list[HuntGroup]
    model: str
    remaining: int


def _today() -> date:
    return datetime.now(timezone.utc).date()


@router.post("/hunt", response_model=HuntOut)
def hunt(body: HuntIn, request: Request, account: Account = Depends(current_account)) -> HuntOut:
    provider = request.app.state.vision
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "hunt not configured")
    try:
        raw = base64.b64decode(body.image, validate=True)
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "image is not base64") from exc
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "image too large")
    with request.app.state.pool.connection() as conn:
        left = require(conn, account.id, HUNT)
        total = conn.execute("SELECT count(*) AS n FROM hunts WHERE created_at >= date_trunc('day', now())").fetchone()[
            "n"
        ]
        if int(total) >= request.app.state.settings.llm_daily_cap:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "hunt is done for today")
        try:
            counts = clean_counts(provider.count(request.app.state.hunt_system, body.media_type, body.image))
        except Exception as exc:
            log.warning("hunt failed: %s", exc)
            raise HTTPException(status.HTTP_404_NOT_FOUND, "hunt unavailable") from exc
        conn.execute("INSERT INTO hunts (account_id, groups) VALUES (%s, %s)", (account.id, len(counts.groups)))
        conn.commit()
    return HuntOut(
        groups=counts.groups,
        model=getattr(provider, "model", "unknown"),
        remaining=left - 1,
    )
