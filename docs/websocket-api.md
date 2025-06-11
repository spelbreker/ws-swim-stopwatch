# WebSocket API Documentation

This document describes all WebSocket message types exchanged between the frontend and backend in the ws-swim-stopwatch project. It covers message structure, direction, and usage examples.

## Message Types

### 1. `ping`
- **Direction:** Client → Server
- **Description:** Sent by the client to measure latency and synchronize time.
- **Payload:**
  ```json
  { "type": "ping", "time": 1718035200000 }
  ```
  - `time`: Client timestamp (ms since epoch)

### 2. `pong`
- **Direction:** Server → Client
- **Description:** Response to `ping`, used for time sync and round-trip time measurement.
- **Payload:**
  ```json
  { "type": "pong", "client_ping_time": 1718035200000, "server_time": 1718035200100 }
  ```
  - `client_ping_time`: Echoes the original ping time
  - `server_time`: Server timestamp (ms since epoch)

### 3. `start`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Starts the stopwatch for a specific event/heat.
- **Payload:**
  ```json
  { "type": "start", "event": 1, "heat": 2, "time": 1718035200000, "timestamp": 1718035200000 }
  ```
  - `event`: Event number or string
  - `heat`: Heat number or string
  - `time`: (optional) Start time
  - `timestamp`: Server-generated timestamp

### 4. `reset` / `stop`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Stops or resets the stopwatch.
- **Payload:**
  ```json
  { "type": "reset", "timestamp": 1718035210000 }
  ```
  - `timestamp`: Server-generated timestamp

### 5. `split`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Records a split/lap for a lane.
- **Payload:**
  ```json
  { "type": "split", "lane": 3, "timestamp": 1718035205000 }
  ```
  - `lane`: Lane number
  - `timestamp`: Split time (ms since epoch)

### 6. `event-heat`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Changes the current event and heat.
- **Payload:**
  ```json
  { "type": "event-heat", "event": 1, "heat": 2 }
  ```
  - `event`: Event number or string
  - `heat`: Heat number or string

### 7. `clear`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Clears all lane and split information on all clients.
- **Payload:**
  ```json
  { "type": "clear" }
  ```

### 9. `time_sync`
- **Direction:** Server → Client (periodic broadcast)
- **Description:** Periodic time synchronization message.
- **Payload:**
  ```json
  { "type": "time_sync", "server_time": 1718035200000 }
  ```
  - `server_time`: Server timestamp (ms since epoch)

### 10. Custom/Other
- **Direction:** Both
- **Description:** Any other message type is broadcast as-is. Structure may vary.

## Example Flow
1. Client sends `ping` to server.
2. Server responds with `pong`.
3. Client sends `start` to begin a race; server broadcasts to all clients.
4. Clients send `split` messages as swimmers reach split points.
5. Client sends `reset` to stop the race; server broadcasts to all clients.
6. Server periodically sends `time_sync` to all clients.

## Notes
- All messages are JSON objects with a `type` field.
- Unknown message types are broadcast to all clients as-is.
- Timestamps are in milliseconds since the Unix epoch (UTC).

---
For implementation details, see `/src/websockets/messageTypes.ts` and `/src/websockets/websocket.ts`.
