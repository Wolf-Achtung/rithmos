"""The rules chat (CLAUDE.md 8.4): a question in the player's words, an answer
from the rule set and nothing else. What the rule set does not settle gets a
fixed sentence. Capped per account and per day; without a key the endpoint is 404."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..auth import Account, current_account
from ..llm import RULES_VERSION, check_answer, normalize_question
from ..quota import RULES, require

router = APIRouter(prefix="/v1", tags=["rules"])
log = logging.getLogger(__name__)

NOT_IN_RULES = "Das steht nicht in dieser Regelfassung."


class QuestionIn(BaseModel):
    question: str = Field(min_length=3, max_length=300)


class AnswerOut(BaseModel):
    answer: str
    grounded: bool
    model: str
    remaining: int
    version: int


@router.post("/rules/ask", response_model=AnswerOut)
def ask(body: QuestionIn, request: Request, account: Account = Depends(current_account)) -> AnswerOut:
    provider = request.app.state.rules
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "rules chat not configured")
    normalized = normalize_question(body.question)
    with request.app.state.pool.connection() as conn:
        left = require(conn, account.id, RULES)
        hit = conn.execute(
            "SELECT answer, grounded, model FROM rule_questions WHERE normalized = %s AND prompt_version = %s "
            "ORDER BY created_at DESC LIMIT 1",
            (normalized, RULES_VERSION),
        ).fetchone()
        if hit:
            answer, grounded, model, cached = hit["answer"], bool(hit["grounded"]), hit["model"], True
        else:
            total = conn.execute(
                "SELECT count(*) AS n FROM rule_questions WHERE NOT cached AND created_at >= date_trunc('day', now())"
            ).fetchone()["n"]
            if int(total) >= request.app.state.settings.llm_daily_cap:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "rules chat is done for today")
            try:
                a = provider.answer(request.app.state.rules_system, body.question)
                problems = check_answer(a, body.question)
                if problems:
                    a = provider.answer(request.app.state.rules_system, body.question)
                    problems = check_answer(a, body.question)
                if problems:
                    raise ValueError("; ".join(problems))
            except Exception as exc:
                log.warning("rules chat failed: %s", exc)
                raise HTTPException(status.HTTP_404_NOT_FOUND, "rules chat unavailable") from exc
            grounded = a.grounded
            answer = a.answer.strip() if grounded else NOT_IN_RULES
            model, cached = getattr(provider, "model", "unknown"), False
        conn.execute(
            "INSERT INTO rule_questions (account_id, question, normalized, answer, grounded, cached, model, prompt_version) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (account.id, body.question.strip(), normalized, answer, grounded, cached, model, RULES_VERSION),
        )
        conn.commit()
    return AnswerOut(
        answer=answer,
        grounded=grounded,
        model=model,
        remaining=left - 1,
        version=RULES_VERSION,
    )
