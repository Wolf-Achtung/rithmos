# Rithmos

Mobile game after the medieval number game *Rithmomachia*. Rules: Peter Mebben after Selenus 1616.
The project description and all binding rules live in `CLAUDE.md`.

```
npm ci                 # install root and app workspace
npm test               # engine tests and pure app tests (vitest)
npm run typecheck      # engine
npm run bench          # harmony and search benchmarks, see engine/BENCHMARK.md

npm run app:web        # Expo dev server for the web
npm run app:export     # static web build to app/dist (set EXPO_PUBLIC_API_URL first, add --clear after changing it)
cd app && npx expo start   # iOS / Android via Expo Go or a development build

npm run jobs:build && node jobs/dist/generate.js --days 7   # Middles puzzles, see jobs/README.md
cd api && .venv/bin/python -m pytest                        # API tests, see api/README.md
```

Layout: `engine/` pure TypeScript, `app/` Expo (SDK 57), `api/` FastAPI, `jobs/` nightly Middles generator,
`infra/` docker-compose and environment variable names (`infra/.env.example`).

Without `EXPO_PUBLIC_API_URL` the app runs offline: local opponent, local coverage trend, a locally generated
Middles puzzle. With the API it adds an anonymous account, coverage across devices and the daily distribution.
