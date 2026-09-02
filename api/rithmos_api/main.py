"""Application factory. The engine lives in the app; this service stores and serves."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import make_pool
from .llm import EXPLAIN_SYSTEM, HUNT_SYSTEM, RULES_SYSTEM, explain_from_env, provider_from_env, rules_from_env, vision_from_env
from .routers import accounts, coverage, explain, health, hunt, middles, narration, puzzles, quota, rules
from .settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pool = make_pool(settings.database_url)
        try:
            yield
        finally:
            app.state.pool.close()

    app = FastAPI(title="Rithmos API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.llm = provider_from_env()
    app.state.vision = vision_from_env()
    app.state.hunt_system = HUNT_SYSTEM
    app.state.rules = rules_from_env()
    app.state.rules_system = RULES_SYSTEM
    app.state.explain = explain_from_env()
    app.state.explain_system = EXPLAIN_SYSTEM
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.include_router(health.router)
    app.include_router(accounts.router)
    app.include_router(coverage.router)
    app.include_router(puzzles.router)
    app.include_router(middles.router)
    app.include_router(narration.router)
    app.include_router(hunt.router)
    app.include_router(rules.router)
    app.include_router(quota.router)
    app.include_router(explain.router)
    return app


def __getattr__(name: str):
    # uvicorn imports rithmos_api.main:app; tests build their own app with create_app()
    if name == "app":
        return create_app()
    raise AttributeError(name)
