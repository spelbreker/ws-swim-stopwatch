---
applyTo: '**/*.ts'
description: 'TypeScript backend conventions for ws-swim-stopwatch'
---

# TypeScript Instructions

## Core Conventions

- Use explicit imports from `express` types (`Request`, `Response`, `Express`) where needed.
- Parse numeric input with base 10, for example `parseInt(value, 10)`.
- Return early in controllers after sending a response.
- Keep controllers as adapters; move data-heavy logic to modules.

## Error Handling

- Map validation errors to 400, missing resources to 404, unexpected failures to 500.
- Avoid swallowing errors silently in modules; log with useful context before rethrowing.
- In controllers, prefer stable user-facing messages and avoid leaking stack traces.

## Route And Controller Pattern

- Register routes in `src/routes/routes.ts`.
- For middleware scoped to route groups, register it before those routes.
- Keep request parsing and response serialization in controllers.

## WebSocket Contract Safety

- Any message change must be reflected in `src/websockets/messageTypes.ts`.
- Keep compatibility with existing browser handlers in `public/**` unless explicitly changing protocol.

## Module And Data Rules

- Centralize competition data file access in module methods.
- Prefer typed return values over `any`.
- Keep file path behavior (`public/competition.json`, `uploads/`, `logs/`) stable unless task requires migration.

## Example Pattern

```ts
export function getEvents(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  try {
    const events = Competition.getEvents(meetIndex);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
  } catch {
    res.status(500).send('Error getting events');
  }
}
```
