# AGENTS Guide For ws-swim-stopwatch

This guide is for coding agents working in this repository.

## 1) Goal And Scope

- Build and maintain a swim stopwatch system with:
  - Express API endpoints
  - WebSocket real-time messaging
  - Static pages in `public/` for remote/screen/training/tunnel views
- Keep competition, tunnel, and device flows stable.

## 2) Stack Summary

- Runtime: Node.js 22+
- Backend: TypeScript + Express 5 + ws
- Frontend: plain browser JavaScript + static HTML/CSS
- Tests: Jest + ts-jest + supertest
- Build: TypeScript compiler (`npm run build`)

## 3) Developer Commands

- `npm ci` - install dependencies
- `npm run build` - compile TS to `dist/`
- `npm test` - run unit/integration tests
- `npm run lint` - run ESLint
- `npm run build:css` - compile Tailwind CSS output
- `docker compose up --build` - run production-like container setup

## 4) Code Organization

- Server startup: `src/server.ts`
- Route map: `src/routes/routes.ts`
- Controllers (HTTP adapters): `src/controllers/**`
- Modules (domain logic): `src/modules/**`
- Middleware: `src/middleware/**`
- WebSocket types/server: `src/websockets/**`
- Public browser code/pages: `public/**`
- Tests mirror source concerns under `test/**`

## 5) Architecture Rules

- Keep controllers thin.
- Put heavy logic and data traversal in modules.
- Keep route registration centralized in `registerRoutes()`.
- Treat `src/websockets/messageTypes.ts` as the message contract.
- Keep tunnel restriction behavior intact when changing routing/static serving.

## 6) Existing Patterns To Follow

### Controller Pattern (validate -> module call -> status mapping)

```ts
export function getHeat(req: Request, res: Response) {
  const eventNumber = parseInt(req.params.event, 10);
  const heatNumber = parseInt(req.params.heat, 10);
  if (!eventNumber || !heatNumber) {
    res.status(400).send('Missing eventNumber or heatNumber');
    return;
  }
  const result = Competition.getHeat(0, undefined, eventNumber, heatNumber);
  if (!result) {
    res.status(404).send('Heat or entries not found');
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(result));
}
```

### Route Registration Pattern

```ts
export function registerRoutes(app: Express, upload: multer.Multer) {
  app.use('/tunnel', json());
  app.post('/competition/upload', upload.single('lenexFile'), uploadCompetition);
  app.get('/competition/event/:event/heat/:heat', getHeat);
  app.get('/devices', getDevicesList);
}
```

### Test Pattern (supertest + mocked module)

```ts
it('should return tunnel status', async () => {
  jest.spyOn(tunnel, 'getStatus').mockReturnValue({ running: false, pid: null, token: null, autoStart: false, allowAllRoutes: false, error: null });
  const res = await request(app).get('/tunnel/status');
  expect(res.status).toBe(200);
  expect(res.body.running).toBe(false);
});
```

## 7) WebSocket Change Rules

- If adding/changing message types, update both:
  - Type unions in `src/websockets/messageTypes.ts`
  - Client handlers in `public/js/*.js` and `public/competition/*.js`
- Preserve backward compatibility unless explicitly told to break it.

## 8) Data And File Safety

- Keep uploads/logs/config volumes and paths stable.
- Do not change `public/competition.json` semantics without updating dependent controllers and screens.
- Avoid destructive file operations beyond current behavior (for example competition delete endpoint).

## 9) CI Awareness

PR CI runs:
- Build (`npm run build`)
- Tests (`npm test`)
- Lint (`npm run lint`)
- Security audit (`npm audit --audit-level=moderate`)

Before finishing substantial changes, run relevant checks locally.

## 10) Change Checklist

- Update tests for changed behavior.
- Keep API error responses explicit (400 vs 404 vs 500).
- Keep browser JS compatible with current global runtime assumptions (`window.socket`, `window.formatLapTime`).
- Keep docs in `README.md` or `docs/` aligned when behavior changes.
