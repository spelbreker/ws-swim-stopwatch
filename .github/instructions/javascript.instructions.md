---
applyTo: 'public/**/*.js'
description: 'Frontend JavaScript conventions for ws-swim-stopwatch ES modules'
---

# JavaScript Instructions

## Runtime Model

- Code runs directly in browsers without a bundler or build step.
- Use native ES modules (`import`/`export`). Page entry points are loaded with `<script type="module">`.
- Import shared utilities from `js/modules/socket.js`, `js/modules/timeSync.js`, `js/modules/format.js`, `js/modules/wakeLock.js`, `js/modules/connectionIndicator.js`.
- Do **not** set or read `window.socket`, `window.formatLapTime`, or `window.TimeSync`.
- Keep compatibility with modern browsers targeted by the project.

## Messaging And Sync

- Use `send(msg)` and `onSocketEvent(callback)` from `js/modules/socket.js` for WebSocket communication.
- Handle WebSocket messages defensively: validate message shape before using fields.
- Keep message type names aligned with server message contracts in `src/websockets/messageTypes.ts`.
- Maintain time-sync behavior when touching stopwatch timing logic.

## DOM And Event Handling

- Guard DOM lookups with null checks before mutation.
- Use event delegation (`data-*` attributes + `addEventListener`) instead of inline `onclick` in `innerHTML`.
- Prefer small pure helper functions for formatting and rendering.
- Avoid repeated expensive DOM work in fast intervals/timers.

## Error Handling

- Surface recoverable user-facing issues through resilient UI fallback behavior.
- Log technical diagnostics with `console.error` or `console.warn` for debugability.
- Keep reconnect logic robust for temporary connection loss.

## Example Pattern

```js
import { onSocketEvent } from '../js/modules/socket.js';

onSocketEvent((event, socket, message) => {
  if (event !== 'message') return;
  if (message.type === 'reset') {
    clearInterval(stopwatchInterval);
    stopwatchElement.textContent = '00:00:00';
  }
});
```
