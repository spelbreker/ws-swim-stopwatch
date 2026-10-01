# Code Review Guidelines

Review this repository as a swim stopwatch system used during live competitions.
Prioritize timing correctness, data integrity, device compatibility, and access
boundaries over cosmetic changes. Read [AGENTS.md](AGENTS.md) for the full project
conventions; this file focuses on applying them during review.

## Review scope and findings

- Review the diff and trace affected callers, consumers, and tests. Focus findings
  on actionable problems introduced or made worse by the change.
- Explain the triggering conditions and concrete impact, cite the relevant file
  and lines, and suggest the smallest practical correction.
- Distinguish blocking defects from optional improvements. Do not request unrelated
  refactors, speculative abstractions, or formatting-only changes.
- Report verification performed and any gaps. Do not imply that a passing backend
  build or test suite verifies browser behavior.

## Architecture and style

- Runtime is Node.js 24+. The backend uses strict TypeScript, Express 5, and `ws`;
  the frontend is static HTML/CSS and native browser JavaScript modules.
- Keep HTTP route registration in `src/routes/routes.ts` (`registerRoutes`).
  Controllers validate inputs, call domain modules, and map results to responses;
  heavy logic and data traversal belong in `src/modules/`.
- Preserve API response shapes and distinguish invalid input, missing resources,
  and internal failures (400, 404, and 500). Ensure responses are not sent twice.
- Follow neighboring code and existing utilities. Prefer explicit types and small,
  focused changes over duplicated logic, unchecked casts, or new dependencies.
- Treat external JSON as runtime input: TypeScript assertions and message unions
  do not validate request bodies or WebSocket payloads.

## Stopwatch and WebSocket correctness

- `src/websockets/messageTypes.ts` is the protocol contract. Changes must be
  reflected in server handlers and affected browser consumers under `public/`,
  including competition and training views.
- Preserve hardware compatibility: existing message names, optional fields,
  string-or-number identifiers, and the legacy `select-event` mapping to
  `event-heat` must remain supported unless a breaking change is explicitly intended.
- Preserve client-provided split timestamps when enriching or broadcasting splits.
  Check time units carefully: millisecond timestamps and `elapsed_ms` must not be
  confused with `timestamp_us` or cooldown values expressed in seconds.
- Trace start, reset, and event/heat/session selection through the server and
  clients. Check that stale lane state or delayed asynchronous selection updates
  cannot affect the next race.
- Preserve `SplitTracker` behavior: splits occur every two pool lengths, relay
  distance contributes to expected splits, distance is capped at the race total,
  and unknown race distance does not imply a finish.
- Check first-split and subsequent-split cooldowns, rejection after finish, and
  ranking by split count descending then timestamp ascending. Boundary changes
  need focused regression tests.
- For connection changes, check sends against socket readiness, device disconnect
  bookkeeping, heartbeat cleanup, and shutdown of recurring timers.

## Browser modules and lifecycle

- Use native imports/exports and `<script type="module">`; there is no JavaScript
  bundling step. Reuse `public/js/modules/` for sockets, synchronization, formatting,
  wake locks, and connection indicators.
- Do not introduce `window.socket`, `window.formatLapTime`, or `window.TimeSync`.
  Import the shared modules instead of creating competing connections or globals.
- Use event delegation with `data-*` attributes and `addEventListener`, not inline
  `onclick` handlers generated in `innerHTML`.
- Ensure reconnects do not accumulate ping intervals or event listeners. Reset and
  disconnect paths must clear stale lane highlights and related timers as needed.
- Check asynchronous initialization and reconnect behavior with the currently
  selected session/event/heat, not just the default selection.
- Treat imported competition data and network values as untrusted when rendering:
  use text APIs or appropriate escaping rather than interpolating them into HTML.

## Tunnel and data safety

- Keep `tunnelRestrictionMiddleware` before static serving and API routes in
  `src/server.ts`. Do not bypass it by moving route or asset registration earlier.
- Preserve the default public screen/read-only route allowlist, root redirect,
  local access, and explicit `allowAllRoutes` opt-in. Review prefix matching when
  adding routes so a public prefix does not accidentally expose an admin endpoint.
- Shared browser modules needed by the public screen must remain available through
  the restricted tunnel. Do not broaden access to uploads, configuration, or
  competition mutation endpoints just to fix a missing asset.
- Do not assume Express HTTP middleware also authorizes WebSocket connections or
  messages; examine the actual WebSocket path when assessing access changes.
- Resolve competition storage through `Competition.filePath()` (`DATA_DIR`, default
  `./data`), never a hard-coded `data/competition.json` path. Preserve persisted
  competition semantics and dependent screens/controllers.
- Keep upload, log, configuration, and container volume paths compatible. Flag
  unintended deletion, overwriting, path traversal, or exposure of secrets/tokens.
- Consult the accepted `js-lenex` / `fast-xml-parser` advisories in `AGENTS.md`.
  Do not report the unchanged accepted baseline as a new regression. Reassess it
  if dependency versions or parser exposure change; do not silence audits or force
  an incompatible parser major version merely to make CI pass.

## Tests and verification

- Tests use Jest, ts-jest, and supertest under `test/`. Follow existing controller
  mocking patterns and add regression coverage for changed behavior.
- Exercise invalid input and missing data as well as successful requests. For
  timing/lifecycle changes, cover boundary values, reset, and repeated reconnects;
  use fake timers and restore mocks/timers after tests.
- For substantial code changes, verify the PR checks: `npm run build`, `npm test`,
  `npm run lint`, and `npm audit --audit-level=moderate`. Explain accepted audit
  findings using `AGENTS.md`; they are not equivalent to a clean audit.
- `npm run lint` covers only `src/` and `test/`; run ESLint separately on changed
  browser JavaScript. The TypeScript build also excludes `public/`.
- Remote lifecycle regressions can be run with
  `npm test -- --runInBand test/modules/remoteFrontend.test.ts`. These use a Node VM,
  DOM stubs, and fake timers; they do not replace browser checks for UI changes.
- For styling changes, check whether `npm run build:css` is needed and verify the
  affected pages. Keep `README.md` or `docs/` aligned with changed user-facing
  behavior, configuration, and protocol expectations.
