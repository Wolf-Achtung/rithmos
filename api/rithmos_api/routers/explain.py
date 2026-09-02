"""'Erklär es mir' (CLAUDE.md 6 on the daily puzzle): after the day is finished the
player says why. The model translates the words into a pattern, the server
compares it with the puzzle's kind and answers with one of the four fields.
One explanation per account and day; without a key the endpoint is 404."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..auth import Account, current_account
from ..llm import explain_input, judge_explanation
from ..quota import EXPLAIN, require

router = APIRouter(prefix="/v1", tags=["explain"])
log = logging.getLogger(__name__)


class ExplainIn(BaseModel):
    text: str = Field(min_length=3, max_length=300)


class ExplainOut(BaseModel):
    pattern: Literal["steps", "factors", "ratio", "unclear"]
    verdict: Literal["understood", "luck", "slip", "misread", "none"]
    model: str
    remaining: int


def _today() -> date:
    return datetime.now(timezone.utc).date()


@router.post("/puzzles/{day}/explain", response_model=ExplainOut)
def explain(day: date, body: ExplainIn, request: Request, account: Account = Depends(current_account)) -> ExplainOut:
    provider = request.app.state.explain
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "explain not configured")
    if day > _today():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
    with request.app.state.pool.connection() as conn:
        attempt = conn.execute(
            "SELECT solved FROM attempts WHERE account_id = %s AND puzzle_date = %s", (account.id, day)
        ).fetchone()
        if attempt is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "finish the puzzle first")
        row = conn.execute("SELECT payload, solution FROM puzzles WHERE date = %s", (day,)).fetchone()
        if row is None or not row["payload"].get("triad"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
        left = require(conn, account.id, EXPLAIN)
        total = conn.execute(
            "SELECT count(*) AS n FROM explanations WHERE created_at >= date_trunc('day', now())"
        ).fetchone()["n"]
        if int(total) >= request.app.state.settings.llm_daily_cap:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "explain is done for today")
        triad = row["payload"]["triad"]
        b = row["solution"].get("move", {}).get("b", triad["a"])
        try:
            claim = provider.translate(
                request.app.state.explain_system, explain_input(body.text, triad["a"], b, triad["c"])
            )
        except Exception as exc:
            log.warning("explain failed for %s: %s", day, exc)
            raise HTTPException(status.HTTP_404_NOT_FOUND, "explain unavailable") from exc
        verdict = judge_explanation(claim.pattern, triad["kind"], bool(attempt["solved"]))
        model = getattr(provider, "model", "unknown")
        conn.execute(
            "INSERT INTO explanations (account_id, puzzle_date, text, pattern, verdict, model) VALUES (%s, %s, %s, %s, %s, %s)",
            (account.id, day, body.text.strip(), claim.pattern, verdict, model),
        )
        conn.commit()
    return ExplainOut(pattern=claim.pattern, verdict=verdict, model=model, remaining=left - 1)
