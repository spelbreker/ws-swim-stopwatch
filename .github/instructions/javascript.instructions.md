---
applyTo: 'public/**/*.js'
description: 'Frontend JavaScript conventions for ws-swim-stopwatch static pages'
---

# JavaScript Instructions

## Runtime Model

- Code runs directly in browsers without a bundler.
- Preserve existing global integrations (`window.socket`, `window.formatLapTime`) used across pages.
- Keep compatibility with modern browsers targeted by the project.

## Messaging And Sync

- Handle WebSocket messages defensively: validate message shape before using fields.
- Keep message type names aligned with server message contracts.
- Maintain time-sync behavior when touching stopwatch timing logic.

## DOM And Event Handling

- Guard DOM lookups with null checks before mutation.
- Prefer small pure helper functions for formatting and rendering.
- Avoid repeated expensive DOM work in fast intervals/timers.

## Error Handling

- Surface recoverable user-facing issues through resilient UI fallback behavior.
- Log technical diagnostics with `console.error` or `console.warn` for debugability.
- Keep reconnect logic robust for temporary connection loss.

## Example Pattern

```js
window.socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'reset') {
    clearInterval(stopwatchInterval);
    stopwatchElement.textContent = '00:00:00';
  }
});
```
