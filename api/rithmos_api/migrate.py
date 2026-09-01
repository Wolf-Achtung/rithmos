"""Apply pending migrations: `python -m rithmos_api.migrate`."""

from __future__ import annotations

import psycopg
from psycopg.rows import dict_row

from .db import migrate
from .settings import Settings


def main() -> None:
    settings = Settings.from_env()
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        applied = migrate(conn)
    print(f"applied migrations: {applied or 'none'}")


if __name__ == "__main__":
    main()
