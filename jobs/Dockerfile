# Nightly Middles generator (jobs/) as a Railway cron service.
#
# Build context is the repository root, because the bundle needs engine/.
# The repository root already carries the API's Dockerfile, so this one has
# to be selected explicitly on the cron service (see jobs/README.md).
# The container runs once per schedule and exits: it generates the next days'
# puzzles, verifies each with the solver, and posts them to the API.
FROM node:22-slim

WORKDIR /srv
ENV NODE_ENV=production

# Root dev dependencies only (rolldown, typescript); the app workspace is skipped.
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
RUN npm ci --include=dev --workspaces=false --ignore-scripts

COPY tsconfig.json ./
COPY engine ./engine
COPY jobs/src ./jobs/src
RUN npm run jobs:build

# RITHMOS_API_URL and RITHMOS_JOBS_TOKEN come from the service variables.
CMD ["node", "jobs/dist/generate.js", "--days", "7"]
