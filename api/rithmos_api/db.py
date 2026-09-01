"""Connection pool and schema migrations (plain SQL files in api/schema)."""

from __future__ import annotations

import re
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"
_VERSION = re.compile(r"^(\d+)_.*\.sql$")


def make_pool(database_url: str) -> ConnectionPool:
    return ConnectionPool(database_url, min_size=1, max_size=8, kwargs={"row_factory": dict_row}, open=True)


def migrate(conn: psycopg.Connection) -> list[int]:
    """Apply every schema/NNN_*.sql above the current version, each in its own transaction."""
    applied: list[int] = []
    with conn.transaction():
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
    current = conn.execute("SELECT coalesce(max(version), 0) AS v FROM schema_migrations").fetchone()
    current_version = int(current["v"]) if isinstance(current, dict) else int(current[0])
    files = sorted((int(m.group(1)), p) for p in SCHEMA_DIR.glob("*.sql") if (m := _VERSION.match(p.name)))
    for version, path in files:
        if version <= current_version:
            continue
        with conn.transaction():
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))
        applied.append(version)
    return applied


@contextmanager
def connection(pool: ConnectionPool) -> Iterator[psycopg.Connection]:
    with pool.connection() as conn:
        yield conn
