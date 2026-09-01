# Rithmos

Mobile game after the medieval number game *Rithmomachia*. Rules: Peter Mebben after Selenus 1616.
The project description and all binding rules live in `CLAUDE.md`.

```
npm ci                 # install root and app workspace
npm test               # engine tests and pure app tests (vitest)
npm run typecheck      # engine
npm run bench          # harmony and search benchmarks, see engine/BENCHMARK.md

npm run app:web        # Expo dev server for the web
npm run app:export     # static web build to app/dist
cd app && npx expo start   # iOS / Android via Expo Go or a development build
```

Layout: `engine/` pure TypeScript, `app/` Expo (SDK 57), `api/`, `jobs/`, `infra/` for later phases.
