# Swim Stopwatch Copilot Instructions

Use this file as the quick, always-on project guide.

## Stack And Runtime
- Node 22+, Express 5, TypeScript backend, static browser JS frontend.
- Build output goes to `dist/`; runtime entry is `dist/server.js`.

## Important Paths
- Server bootstrap: `src/server.ts`
- Route registration: `src/routes/routes.ts`
- Controllers: `src/controllers/**`
- Domain modules: `src/modules/**`
- WebSocket protocol types: `src/websockets/messageTypes.ts`
- Public client assets: `public/**`
- Tests: `test/**`

## Commands
- Install: `npm ci`
- Build TS: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Build CSS: `npm run build:css`

## Project Rules
- Keep controllers thin; business/data logic belongs in modules.
- Keep route wiring centralized in `registerRoutes()`.
- For query/path params, parse explicitly (for example `parseInt(value, 10)`) and return 4xx for invalid input.
- Preserve WebSocket message compatibility when changing `messageTypes.ts`; update both server and `public/**` consumers together.
- Keep competition data file behavior stable (`public/competition.json`, logs, uploads).
- In tunnel code, preserve restricted-route behavior used by Cloudflare tunnel mode.

## Testing Expectations
- Add or update Jest tests in `test/**` for controller/module behavior changes.
- Prefer route-level tests with `supertest` for HTTP behavior.
- Mock module calls in controller tests; assert status code + response body.