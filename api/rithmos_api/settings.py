"""Settings from environment variables. Names are listed in infra/.env.example."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    jobs_token: str | None
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL is not set")
        origins = tuple(o.strip() for o in os.environ.get("RITHMOS_CORS_ORIGINS", "").split(",") if o.strip())
        return cls(database_url=url, jobs_token=os.environ.get("RITHMOS_JOBS_TOKEN") or None, cors_origins=origins)
