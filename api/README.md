# api

FastAPI service for Rithmos: anonymous accounts, coverage sync across devices, daily Middles puzzles.
The engine never runs here; puzzles arrive verified from `jobs/`, the server compares moves with the
stored solution.

```
cd api
uv venv .venv && uv pip install --python .venv/bin/python -e ".[test]"
DATABASE_URL=postgresql:///rithmos .venv/bin/python -m rithmos_api.migrate
DATABASE_URL=postgresql:///rithmos .venv/bin/uvicorn rithmos_api.main:app --reload
.venv/bin/python -m pytest          # needs a local PostgreSQL; DATABASE_URL_TEST overrides the server
```

Environment variables: see `infra/.env.example`. Schema: `schema/*.sql`, applied in order by
`rithmos_api.migrate` (also on every start, see `Procfile` and `Dockerfile`).

## Endpoints (v1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | – | liveness and schema version |
| POST | `/v1/accounts` | – | create an anonymous account, returns the bearer token once |
| GET | `/v1/me` | bearer | account summary |
| PUT | `/v1/coverage` | bearer | idempotent upload of coverage records (client ids) |
| GET | `/v1/coverage` | bearer | all records of the account, oldest first |
| GET | `/v1/puzzles/today`, `/v1/puzzles/{date}` | optional | the puzzle without its solution |
| POST | `/v1/puzzles/{date}/attempts` | bearer | the one attempt; returns solved, solution, harmony, distribution |
| GET | `/v1/puzzles/{date}/distribution` | – | attempts, solved, histogram of tries |
| POST | `/v1/admin/puzzles` | `x-jobs-token` | ingestion from the nightly job |

Railway: root directory `api`, start command from `Procfile`, variables `DATABASE_URL`,
`RITHMOS_JOBS_TOKEN`, `RITHMOS_CORS_ORIGINS`.
