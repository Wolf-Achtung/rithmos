"""Tests run against a real PostgreSQL. DATABASE_URL_TEST names the server; a fresh
database is created per session. Default: the local socket, database rithmos_test."""

from __future__ import annotations

import os

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from rithmos_api.db import migrate
from rithmos_api.main import create_app
from rithmos_api.settings import Settings

TEST_DB = "rithmos_test"


def _admin_url() -> str:
    return os.environ.get("DATABASE_URL_TEST", "postgresql:///postgres")


def _test_url() -> str:
    base = _admin_url()
    return base.rsplit("/", 1)[0] + "/" + TEST_DB


@pytest.fixture(scope="session")
def database_url() -> str:
    with psycopg.connect(_admin_url(), autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
        conn.execute(f"CREATE DATABASE {TEST_DB}")
    url = _test_url()
    with psycopg.connect(url, row_factory=dict_row) as conn:
        migrate(conn)
    return url


@pytest.fixture()
def client(database_url: str):
    settings = Settings(database_url=database_url, jobs_token="test-jobs-token", cors_origins=())
    app = create_app(settings)
    with TestClient(app) as c:
        yield c
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute("TRUNCATE attempts, coverage_records, puzzles, accounts CASCADE")
