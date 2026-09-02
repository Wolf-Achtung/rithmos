import psycopg
from psycopg.rows import dict_row

from rithmos_api.db import migrate


def test_migrate_is_idempotent(database_url):
    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        assert migrate(conn) == []
        v = conn.execute("SELECT max(version) AS v FROM schema_migrations").fetchone()["v"]
        assert v == 3
