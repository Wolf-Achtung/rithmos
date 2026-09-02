"""Daily quotas per account (CLAUDE.md, Stufe 6 as decided for the test phase):
no paywall, every feature is open, and the ones that cost a model call are
counted per account and day. The limits live here and nowhere else; a later
subscription lifts them by changing what this module returns."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status


@dataclass(frozen=True)
class Feature:
    name: str
    table: str
    per_day: int


HUNT = Feature("hunt", "hunts", 1)
RULES = Feature("rules", "rule_questions", 3)
EXPLAIN = Feature("explain", "explanations", 1)
FEATURES = (HUNT, RULES, EXPLAIN)


def used_today(conn: Any, account_id: Any, feature: Feature) -> int:
    row = conn.execute(
        f"SELECT count(*) AS n FROM {feature.table} WHERE account_id = %s AND created_at >= date_trunc('day', now())",
        (account_id,),
    ).fetchone()
    return int(row["n"])


def remaining(conn: Any, account_id: Any, feature: Feature) -> int:
    return max(0, feature.per_day - used_today(conn, account_id, feature))


def require(conn: Any, account_id: Any, feature: Feature) -> int:
    """The uses left before this one; 429 when the day's quota is spent."""
    left = remaining(conn, account_id, feature)
    if left <= 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"no more {feature.name} today")
    return left
