# jobs

Nightly Middles generator. Pure Node, uses `engine/` through a Rolldown bundle.

```
npm run jobs:build                       # bundle to jobs/dist/generate.js
node jobs/dist/generate.js --days 7      # print puzzles as JSON
RITHMOS_API_URL=... RITHMOS_JOBS_TOKEN=... node jobs/dist/generate.js --days 7   # post to the API
```

Every puzzle is verified with `engine/solver.ts` before it leaves the job: exactly one move
completes a harmony, and it is the stored one. The puzzle for a date is deterministic.
