# WebSocket API Documentation

This document describes all WebSocket message types exchanged between the frontend and backend in the ws-swim-stopwatch project. It covers message structure, direction, and usage examples.

## Table of Contents

- [Time Sync](#time-sync)
- [Stopwatch Control](#stopwatch-control)
- [Event and Heat Control](#event-and-heat-control)
- [Device Management](#device-management)
- [Time Synchronization Behavior](#time-synchronization-behavior)
- [WebSocket State Diagram](#websocket-state-diagram-for-stopwatch)
- [Device Registration Flow](#device-registration-flow)
- [Notes](#notes)

## Message Types

## Time Sync

### `ping`
- **Direction:** Client → Server
- **Description:** Sent by the client to measure latency and synchronize time.
- **Payload:**
  ```json
  { "type": "ping", "time": 1718035200000 }
  ```
  - `time`: Client timestamp (ms since epoch)

### `pong`
- **Direction:** Server → Client
- **Description:** Response to `ping`, used for time sync and round-trip time measurement.
- **Payload:**
  ```json
  { "type": "pong", "client_ping_time": 1718035200000, "server_time": 1718035200100 }
  ```
  - `client_ping_time`: Echoes the original ping time
  - `server_time`: Server timestamp (ms since epoch)

###  `time_sync`
- **Direction:** Server → Client (periodic broadcast)
- **Description:** Periodic time synchronization message.
- **Payload:**
  ```json
  { "type": "time_sync", "server_time": 1718035200000 }
  ```
  - `server_time`: Server timestamp (ms since epoch)

## Stopwatch Control

### `start`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Starts the stopwatch for a specific event/heat.
- **Payload (Outgoing):**
  ```json
  { "type": "start", "event": 1, "heat": 2, "timestamp": 1718035200000.1234 }
  ```
- **Payload (Incoming - Server broadcast):**
  ```json
  { "type": "start", "event": 1, "heat": 2, "timestamp": 1718035200000.1234, "server_timestamp": 1718035200003 }
  ```
  - `event`: Event number or string
  - `heat`: Heat number or string
  - `timestamp`: Start time (ms since epoch, client-generated with server offset applied, preserved by server)
  - `server_timestamp`: Server's local timestamp when message was processed (added by server)

### `reset` / `stop`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Stops or resets the stopwatch.
- **Payload (Outgoing):**
  ```json
  { "type": "reset" }
  ```
- **Payload (Incoming - Server broadcast):**
  ```json
  { "type": "reset", "timestamp": 1718035210000, "server_timestamp": 1718035210003 }
  ```
  - `timestamp`: Server-generated timestamp for reset time
  - `server_timestamp`: Server's local timestamp when message was processed

### `split` / `lap`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Records a split/lap for a lane.
- **Payload (Outgoing):**
  ```json
  { "type": "split", "lane": 3, "timestamp": 1718035205000.5678 }
  ```
- **Payload (Incoming - Server broadcast):**
  ```json
  { "type": "split", "lane": 3, "timestamp": 1718035205000.5678, "server_timestamp": 1718035205003 }
  ```
  - `lane`: Lane number (0-9)
  - `timestamp`: Split time (ms since epoch, client-generated with server offset applied, preserved by server)
  - `server_timestamp`: Server's local timestamp when message was processed (added by server)

## Event and Heat Control

### `event-heat`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Changes the current event and heat. only when stopped.
- **Payload:**
  ```json
  { "type": "event-heat", "event": 1, "heat": 2 }
  ```
  - `event`: Event number or string
  - `heat`: Heat number or string

### `clear`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Clears all lane and split information on all clients.
- **Payload (Outgoing):**
  ```json
  { "type": "clear" }
  ```
- **Payload (Incoming - Server broadcast):**
  ```json
  { "type": "clear", "server_timestamp": 1718035220000 }
  ```
  - `server_timestamp`: Server's local timestamp when message was processed (added by server)

## Device Management

These messages are used to manage hardware devices (e.g., starter devices, lane timers) that connect via WebSocket from the [swimwatch-hardware](https://github.com/spelbreker/swimwatch-hardware) project.

### `device_register`
- **Direction:** Device → Server
- **Description:** Sent by hardware devices upon connection to register their information with the server.
- **Payload:**
  ```json
  { "type": "device_register", "mac": "00:11:22:33:44:55", "ip": "192.168.1.100", "role": "starter", "lane": 1 }
  ```
  - `mac`: MAC address of the device (required, string)
  - `ip`: IP address of the device (required, string)
  - `role`: Device role, either `"starter"` or `"lane"` (required)
  - `lane`: Lane number (optional, number) - only relevant for lane devices

**Note:** This message is not broadcast to other clients. The server stores device information internally and makes it available via the `/devices` REST API endpoint.

### `device_update_role`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Updates the role of a registered device.
- **Payload (Outgoing):**
  ```json
  { "type": "device_update_role", "mac": "00:11:22:33:44:55", "role": "lane" }
  ```
  - `mac`: MAC address of the device to update (required, string)
  - `role`: New role for the device, either `"starter"` or `"lane"` (required)

**Behavior:** The server updates the device's role in memory and broadcasts the message to all connected clients, allowing real-time synchronization of device configurations.

### `device_update_lane`
- **Direction:** Client → Server (broadcast to all clients)
- **Description:** Updates the lane number for a registered device.
- **Payload (Outgoing):**
  ```json
  { "type": "device_update_lane", "mac": "00:11:22:33:44:55", "lane": 3 }
  ```
  - `mac`: MAC address of the device to update (required, string)
  - `lane`: New lane number (required, number)

**Behavior:** The server updates the device's lane number in memory and broadcasts the message to all connected clients.

### Device Management REST API
In addition to WebSocket messages, device information can be retrieved via REST:

**GET /devices**
- **Description:** Returns a list of all registered devices with their current status.
- **Response:**
  ```json
  {
    "devices": [
      {
        "mac": "00:11:22:33:44:55",
        "ip": "192.168.1.100",
        "role": "starter",
        "lane": 1,
        "connected": true,
        "lastSeen": 1718035220000
      },
      {
        "mac": "AA:BB:CC:DD:EE:FF",
        "ip": "192.168.1.101",
        "role": "lane",
        "lane": 3,
        "connected": false,
        "lastSeen": 1718035200000
      }
    ]
  }
  ```

**Device Fields:**
- `mac`: Device MAC address
- `ip`: Device IP address
- `role`: Device role (`"starter"` or `"lane"`)
- `lane`: Lane number (optional, only for lane devices)
- `connected`: Current connection status (boolean)
- `lastSeen`: Timestamp of last activity (ms since epoch)

**Notes:**
- Device state is stored in-memory and will reset when the server restarts
- Devices are automatically marked as disconnected when their WebSocket connection closes
- The `/devices` endpoint is used by the device management UI at `/devices.html`

## Time Synchronization Behavior

### Client Time Synchronization
1. **Initial Sync:** Clients perform rapid ping sequence (5 pings at 500ms intervals) upon connection
2. **Ongoing Sync:** Regular pings every 5 seconds + periodic `time_sync` messages
3. **Offset Calculation:** Clients calculate `serverTimeOffset = (server_time - client_time - rtt/2)`
4. **Usage:** All outgoing timestamps use `Date.now() + serverTimeOffset` for synchronization

### Timestamp Preservation
- **Client → Server:** Clients send synchronized timestamps (local time + server offset)
- **Server Behavior:** Server preserves original client timestamps (no overwriting)
- **Server → Clients:** All clients receive identical timestamps, ensuring perfect synchronization
- **Precision:** Timestamps maintain decimal precision (sub-millisecond accuracy)

### Custom/Other
- **Direction:** Both
- **Description:** Any other message type is broadcast as-is. Structure may vary.

## WebSocket State Diagram for stopwatch

Below is a state diagram illustrating the main states and transitions for stopwatch and event/heat control via the WebSocket API.

```mermaid
stateDiagram-v2
    [*] --> Idle: Connection established
    Idle --> TimeSyncing: Initial ping sequence
    TimeSyncing --> Stopped: Sync complete
    Stopped --> Running : start message
    Running --> Stopped : reset message
    Running --> Running : split message
    Stopped --> Stopped : event-heat message
    Stopped --> Stopped : clear message
    
    state Running {
        [*] --> Timing
        Timing --> Timing : split (lane 0-9)
        Timing --> LapRecorded : split processed
        LapRecorded --> Timing : continue timing
    }
    
    note right of TimeSyncing
        5 rapid pings every 500ms
        Calculate server offset
        Switch to normal ping interval (5s)
    end note
    
    note right of Running
        Stopwatch active
        Accept split times
        Display synchronized across devices
    end note
```

**State Descriptions:**
- **Idle:** Initial connection state, waiting for time sync
- **TimeSyncing:** Performing initial rapid ping sequence for time synchronization
- **Stopped:** Stopwatch inactive, can change event/heat, clear data, or start timing
- **Running:** Stopwatch active, recording split times with synchronized timestamps
- **Timing:** Within running state, actively timing the race
- **LapRecorded:** Momentary state when a split is recorded and broadcast

This diagram summarizes the control flow; actual message payloads and additional details are described above.


## Notes
- All messages are JSON objects with a `type` field.
- Unknown message types are broadcast to all clients as-is.
- Timestamps are in milliseconds since the Unix epoch (UTC) with decimal precision.
- **Server adds `server_timestamp`** to all broadcast messages for debugging/logging purposes.
- **Client timestamps are preserved** by the server to maintain synchronization across devices.
- **Time synchronization ensures** all devices show identical split times regardless of network latency.

## Time Synchronization Architecture

```mermaid
sequenceDiagram
    participant C1 as Client 1 (Remote)
    participant S as Server
    participant C2 as Client 2 (Screen)
    
    Note over C1,C2: Initial Time Sync
    C1->>S: ping {time: local_time}
    S->>C1: pong {client_ping_time, server_time}
    Note over C1: Calculate offset = (server_time - local_time - rtt/2)
    
    C2->>S: ping {time: local_time}
    S->>C2: pong {client_ping_time, server_time}
    Note over C2: Calculate offset = (server_time - local_time - rtt/2)
    
    Note over C1,C2: Synchronized Timing
    C1->>S: start {timestamp: Date.now() + offset}
    S->>C1: start {timestamp: preserved, server_timestamp}
    S->>C2: start {timestamp: preserved, server_timestamp}
    
    C1->>S: split {timestamp: Date.now() + offset}
    S->>C1: split {timestamp: preserved, server_timestamp}
    S->>C2: split {timestamp: preserved, server_timestamp}
    
    Note over C1,C2: Both clients show identical times!
```

## Device Registration Flow

Below is a sequence diagram showing how hardware devices register and how configuration updates are synchronized across clients.

```mermaid
sequenceDiagram
    participant D as Hardware Device
    participant S as Server
    participant UI as Device Manager UI
    participant C as Other Clients
    
    Note over D,C: Device Registration
    D->>S: WebSocket Connect
    D->>S: device_register {mac, ip, role, lane}
    Note over S: Store device info in memory<br/>Mark as connected
    
    Note over D,C: Configuration Update from UI
    UI->>S: device_update_role {mac, role}
    Note over S: Update device role<br/>Update lastSeen timestamp
    S->>UI: Broadcast: device_update_role
    S->>C: Broadcast: device_update_role
    S->>D: Broadcast: device_update_role
    
    UI->>S: device_update_lane {mac, lane}
    Note over S: Update device lane<br/>Update lastSeen timestamp
    S->>UI: Broadcast: device_update_lane
    S->>C: Broadcast: device_update_lane
    S->>D: Broadcast: device_update_lane
    
    Note over D,C: Device List Retrieval
    UI->>S: GET /devices (REST API)
    S->>UI: {devices: [{mac, ip, role, lane, connected, lastSeen}]}
    
    Note over D,C: Device Disconnection
    D->>S: WebSocket Close
    Note over S: Mark device as disconnected<br/>Update lastSeen timestamp
```

**Device Management Workflow:**
1. **Registration:** Hardware devices connect via WebSocket and send `device_register` with their metadata
2. **Tracking:** Server maintains a Map of all devices with connection status and timestamps
3. **Configuration:** Management UI can update device role and lane number via WebSocket messages
4. **Synchronization:** Configuration changes are broadcast to all connected clients including the devices themselves
5. **Monitoring:** The `/devices` REST endpoint provides current device list with connection status
6. **Cleanup:** When a device disconnects, it's marked as disconnected but remains in the list with its last seen timestamp

---
For implementation details, see `/src/websockets/messageTypes.ts` and `/src/websockets/websocket.ts`.
