# jobs

Nightly Middles generator. Pure Node, uses `engine/` through a Rolldown bundle.

```
npm run jobs:build                       # bundle to jobs/dist/generate.js
node jobs/dist/generate.js --days 7      # print puzzles as JSON
RITHMOS_API_URL=... RITHMOS_JOBS_TOKEN=... node jobs/dist/generate.js --days 7   # post to the API
```

Every puzzle is verified with `engine/solver.ts` before it leaves the job: exactly one move
completes a harmony, and it is the stored one. The puzzle for a date is deterministic.

## Railway cron service

`jobs/Dockerfile` builds a container that runs the generator once and exits. It builds from the
repository root (the bundle needs `engine/`), installs only the root dev dependencies and skips
the app workspace, so the image stays small (about 100 MB of modules).

Because the repository root also carries the API's `Dockerfile`, a second Railway service from the
same repository would build that one by default. On the cron service, point Railway at this file
instead. Railway exposes the Dockerfile path as a service setting or as the service variable
`RAILWAY_DOCKERFILE_PATH`; set it to `jobs/Dockerfile`. (Railway's docs were not reachable from the
session that wrote this; check the setting name in the service's build settings.)

Service settings:

- Root Directory: empty
- Dockerfile path: `jobs/Dockerfile`
- Cron schedule: once a night, for example `30 2 * * *` (UTC); the job generates the next 7 days,
  so a missed night does not leave the API without a puzzle
- Variables: `RITHMOS_API_URL` (the API's public URL, without trailing slash) and
  `RITHMOS_JOBS_TOKEN` (the same value as on the API service)

A successful run logs `posted 7 puzzles (<first date> .. <last date>)` and exits with 0. Dates that
already have attempts are left untouched by the API (`skipped` in its response).
