"""Settings from environment variables. Names are listed in infra/.env.example."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    jobs_token: str | None
    cors_origins: tuple[str, ...]
    # How many narrations the language model may phrase per day. The cache makes this the
    # ceiling on model calls: one per puzzle, not per player.
    llm_daily_cap: int = 50

    @classmethod
    def from_env(cls) -> "Settings":
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL is not set")
        origins = tuple(o.strip() for o in os.environ.get("RITHMOS_CORS_ORIGINS", "").split(",") if o.strip())
        return cls(
            database_url=url,
            jobs_token=os.environ.get("RITHMOS_JOBS_TOKEN") or None,
            cors_origins=origins,
            llm_daily_cap=int(os.environ.get("RITHMOS_LLM_DAILY_CAP", "50")),
        )
