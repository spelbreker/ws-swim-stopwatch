---
applyTo: '**'
description: 'Review rules for ws-swim-stopwatch pull requests'
---

# Review Instructions

## Review Philosophy

- Prioritize correctness, regressions, security, and protocol compatibility.
- Be concise and specific; include only actionable findings.
- Stay silent when code is correct and follows repository patterns.

## Priority Areas

1. API correctness and status code semantics (400/404/500).
2. WebSocket message contract safety across server and browser clients.
3. Tunnel restriction behavior and access control boundaries.
4. Competition data parsing/storage behavior and file handling safety.
5. Test coverage for changed logic paths.

## CI Context (Already Enforced)

From `.github/workflows/pull-request.yml`, CI already checks:
- TypeScript build: `npm run build`
- Test suite: `npm test`
- Lint: `npm run lint`
- Security audit: `npm audit --audit-level=moderate`

## Skip These In Review Comments

- Pure formatting/style points that lint already enforces.
- Generic "add tests" comments when tests already cover changed paths.
- Suggestions unrelated to changed code unless they expose a real defect.

## Response Format

For each finding provide:
1. Problem: what is wrong.
2. Why it matters: failure mode or risk.
3. Fix: minimal concrete change.

## When To Stay Silent

- Code matches established patterns in controllers/modules/routes.
- Behavior is covered by existing or added tests.
- No security/correctness/performance regression is evident.
