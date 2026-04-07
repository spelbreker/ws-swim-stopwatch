---
applyTo: 'test/**/*.test.ts'
description: 'Testing standards for ws-swim-stopwatch'
---

# Testing Instructions

## Test Framework

- Use Jest with `ts-jest` setup from `jest.config.js`.
- Use `supertest` for HTTP route/controller tests.
- Keep tests deterministic and isolated.

## Structure

- Mirror source domains in `test/` (controllers/modules/middleware).
- Group by function/endpoint behavior with clear `describe` blocks.
- Use descriptive test names that state expected outcome.

## Mocking

- Mock module dependencies from controllers using `jest.spyOn`.
- Restore spies after each test.
- Assert both status code and response payload/body.

## Coverage Expectations

For changed code, cover:
- Success path
- Validation failures (400)
- Missing resources (404) where applicable
- Unexpected failure handling (500)

## Example Pattern

```ts
it('should return error when tunnel start fails', async () => {
  jest.spyOn(tunnel, 'startTunnel').mockReturnValue({ success: false, error: 'No tunnel token configured' });
  const res = await request(app).post('/tunnel/start').send({});
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('No tunnel token configured');
});
```
