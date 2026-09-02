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
`rithmos_api.migrate`, which also runs before the server on every start (see the `Dockerfile`
in the repository root).

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

## Railway

The image is built from the **repository root** by the `Dockerfile` there, which copies `api/`
into `/srv`. So leave the service's **Root Directory empty**: pointed at `api`, Railway no longer
sees that Dockerfile; pointed at the root without it, Railway autodetects the npm workspace in
`package.json`, looks for a Node start command and the build fails.

Required variables: `DATABASE_URL` (reference the Railway PostgreSQL service), `RITHMOS_JOBS_TOKEN`,
`RITHMOS_CORS_ORIGINS`. `PORT` is injected by Railway. Without `DATABASE_URL` the container exits
immediately with `RuntimeError: DATABASE_URL is not set` instead of starting half-configured.
The service needs a generated domain before the app can reach it; `/health` answers
`{"ok": true, "schema_version": N}`.

`Procfile` is kept for a non-Docker deployment of `api/` and is unused by the Dockerfile build.
