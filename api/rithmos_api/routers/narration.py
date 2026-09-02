"""The narrator (CLAUDE.md 8.1, Stufe 3): served only for a day the account has
finished, phrased once per puzzle by the language model and cached. Without a
key, or above the daily cap, the endpoint answers 404 and the app keeps its
fixed sentence. Labelled per AI Act Art. 50 in the app."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from ..auth import Account, current_account
from ..llm import PROMPT_VERSION, facts_for, narrate

router = APIRouter(prefix="/v1", tags=["narration"])
log = logging.getLogger(__name__)

# after this many failed phrasings of one day's narration the server stops asking the
# model for that day: a failure costs two model calls and would otherwise repeat on
# every page load. In memory; a restart gives the day another chance.
GIVE_UP_AFTER = 3
_failures: dict[tuple[str, int], int] = {}


class NarrationOut(BaseModel):
    monk: str
    analyst: str
    """Three explanations in a fixed shuffled order; `truth` is the index of the true one."""
    statements: list[str]
    truth: int
    model: str
    version: int


def _today() -> date:
    return datetime.now(timezone.utc).date()


@router.get("/puzzles/{day}/narration", response_model=NarrationOut)
def narration(day: date, request: Request, account: Account = Depends(current_account)) -> NarrationOut:
    provider = request.app.state.llm
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "narrator not configured")
    if day > _today():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
    with request.app.state.pool.connection() as conn:
        finished = conn.execute(
            "SELECT 1 FROM attempts WHERE account_id = %s AND puzzle_date = %s", (account.id, day)
        ).fetchone()
        if finished is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "finish the puzzle first")
        cached = conn.execute(
            "SELECT model, payload FROM narrations WHERE puzzle_date = %s AND version = %s", (day, PROMPT_VERSION)
        ).fetchone()
        if cached is not None:
            return NarrationOut(model=cached["model"], version=PROMPT_VERSION, **cached["payload"])
        row = conn.execute("SELECT payload, solution FROM puzzles WHERE date = %s", (day,)).fetchone()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
        facts = facts_for(row["payload"], row["solution"])
        if facts is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no narration facts for that puzzle")
        used = conn.execute(
            "SELECT count(*) AS n FROM narrations WHERE created_at >= date_trunc('day', now())"
        ).fetchone()["n"]
        if int(used) >= request.app.state.settings.llm_daily_cap:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "narrator is done for today")
        key = (day.isoformat(), PROMPT_VERSION)
        if _failures.get(key, 0) >= GIVE_UP_AFTER:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "narration given up for today")
        try:
            n = narrate(provider, facts)
        except Exception as exc:  # the model is additive: any failure means the fixed text
            _failures[key] = _failures.get(key, 0) + 1
            log.warning("narration failed for %s (%d/%d): %s", day, _failures[key], GIVE_UP_AFTER, exc)
            raise HTTPException(status.HTTP_404_NOT_FOUND, "narration unavailable") from exc
        # a fixed shuffle per day, so every player sees the same order
        order = [0, 1, 2]
        rotate = day.toordinal() % 3
        order = order[rotate:] + order[:rotate]
        texts = [n.truth, n.lies[0], n.lies[1]]
        statements = [texts[i] for i in order]
        payload = {"monk": n.monk, "analyst": n.analyst, "statements": statements, "truth": order.index(0)}
        conn.execute(
            "INSERT INTO narrations (puzzle_date, version, model, payload) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (puzzle_date, version) DO NOTHING",
            (day, PROMPT_VERSION, getattr(provider, "model", "unknown"), Jsonb(payload)),
        )
        conn.commit()
    return NarrationOut(model=getattr(provider, "model", "unknown"), version=PROMPT_VERSION, **payload)
