# Rithmos

Mobile game after the medieval number game *Rithmomachia*. Rules: Peter Mebben after Selenus 1616.
The project description and all binding rules live in `CLAUDE.md`.

```
npm ci                 # install root and app workspace
npm test               # engine tests and pure app tests (vitest)
npm run typecheck      # engine
npm run bench          # harmony and search benchmarks, see engine/BENCHMARK.md

npm run app:web        # Expo dev server for the web
npm run app:export     # static web build to app/dist (set EXPO_PUBLIC_API_URL first)
cd app && npx expo start   # iOS / Android via Expo Go or a development build

npm run jobs:build && node jobs/dist/generate.js --days 7   # Middles puzzles, see jobs/README.md
cd api && .venv/bin/python -m pytest                        # API tests, see api/README.md
```

Layout: `engine/` pure TypeScript, `app/` Expo (SDK 57), `api/` FastAPI, `jobs/` nightly Middles generator,
`infra/` docker-compose and environment variable names (`infra/.env.example`).

The `Dockerfile` in this directory builds the API service from `api/`. It sits at the root because
Railway builds a service from its root directory: with the Dockerfile there the API is built, without
it Railway autodetects the npm workspace and fails for lack of a Node start command. See `api/README.md`.

`netlify.toml` holds the web build for Netlify: `npm run app:export` into `app/dist`. It overrides the
build settings configured in the Netlify UI.

`EXPO_PUBLIC_API_URL` is compiled into the bundle at build time, so it belongs in the deploy
environment, not in a running build. Without it the app runs offline: local opponent, local coverage
trend, a locally generated Middles puzzle. With the API it adds an anonymous account, coverage across
devices and the daily distribution. The web export always clears the Metro cache, so a changed address
never leaves a stale one in the bundle.
