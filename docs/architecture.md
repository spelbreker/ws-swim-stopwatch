# Architecture Overview

This document describes the high-level architecture of the ws-swim-stopwatch
application: the layers, the request flow, the runtime topology and the
key design rules that keep the codebase maintainable.

## Table of Contents

- [System Context](#system-context)
- [High-Level Architecture](#high-level-architecture)
- [Request Flow](#request-flow)
- [Backend Layers](#backend-layers)
- [Frontend Layers](#frontend-layers)
- [Data Storage](#data-storage)
- [Configuration](#configuration)
- [Design Rules](#design-rules)

## System Context

```mermaid
graph LR
    subgraph Hardware
        Starter[Starter device]
        Lane[Lane timer]
    end

    subgraph Server[ws-swim-stopwatch]
        Express[Express HTTP]
        WS[WebSocket server]
        Modules[Domain modules]
    end

    subgraph Clients
        Remote[Competition Remote]
        Screen[Competition Screen]
        Admin[Admin pages]
    end

    subgraph External
        CF[Cloudflare Tunnel]
        Public[Public viewers]
    end

    Starter -->|WebSocket| WS
    Lane -->|WebSocket| WS
    Remote -->|HTTP + WebSocket| Express
    Remote -->|WebSocket| WS
    Screen -->|HTTP + WebSocket| Express
    Screen -->|WebSocket| WS
    Admin -->|HTTP| Express
    Express --> Modules
    WS --> Modules
    CF -->|tunnel| Express
    Public -->|HTTPS via CF| Screen
```

The server is a single Node.js process that hosts both the HTTP API and the
WebSocket server on the same port (8080). Hardware devices (starter and lane
timers from the [swimwatch-hardware](https://github.com/spelbreker/swimwatch-hardware)
project) connect over WebSocket. Operators use the Remote and Screen pages in
the browser. A Cloudflare Tunnel can expose a restricted subset of pages to
the public internet.

## High-Level Architecture

```mermaid
graph TB
    subgraph Entry
        Server[server.ts]
    end

    subgraph HTTP
        MW[tunnelRestriction middleware]
        Static[express.static public/]
        Routes[routes.ts]
        Controllers[controllers/**]
    end

    subgraph WebSocket
        WSSetup[websocket.ts]
        MsgTypes[messageTypes.ts]
        Logger[logger.ts]
    end

    subgraph Modules
        Competition[competition.ts]
        SplitTracker[splitTracker.ts]
        Settings[settings.ts]
        Tunnel[tunnel.ts]
    end

    subgraph Storage
        Data[data/competition.json]
        AppConfig[config/app.json]
        TunnelConfig[config/tunnel.json]
        Logs[logs/competition.log]
        Uploads[uploads/]
    end

    Server --> MW
    MW --> Static
    MW --> Routes
    Routes --> Controllers
    Controllers --> Competition
    Controllers --> Settings
    Controllers --> Tunnel

    Server --> WSSetup
    WSSetup --> MsgTypes
    WSSetup --> Logger
    WSSetup --> SplitTracker
    WSSetup --> Competition
    SplitTracker --> Settings
    SplitTracker --> Competition

    Competition --> Data
    Competition --> Uploads
    Settings --> AppConfig
    Tunnel --> TunnelConfig
    Logger --> Logs
```

## Request Flow

### HTTP request lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant MW as tunnelRestriction
    participant Static as express.static
    participant Routes as registerRoutes
    participant Controller
    participant Module

    Client->>MW: HTTP request
    alt From Cloudflare tunnel
        MW->>MW: Check allowlist
        alt Path allowed
            MW->>Static: next()
        else Path blocked
            MW-->>Client: 403 Forbidden
        end
    else Local access
        MW->>Static: next()
    end
    alt Static file matches
        Static-->>Client: file
    else API route
        Static->>Routes: next()
        Routes->>Controller: handler
        Controller->>Module: domain call
        Module-->>Controller: result
        Controller-->>Client: JSON / redirect
    end
```

The tunnel restriction middleware runs **before** static serving and route
registration. Local requests (no Cloudflare headers) are always allowed.
Tunnelled requests are checked against an allowlist; admin pages, settings,
upload, logs and the remote are blocked by default.

### WebSocket message lifecycle

```mermaid
sequenceDiagram
    participant Device as Hardware / Remote
    participant WS as websocket.ts
    participant Tracker as SplitTracker
    participant Logger as logger.ts
    participant Clients as All clients

    Device->>WS: JSON message
    WS->>WS: parse + isMessage check
    alt start / reset / event-heat
        WS->>Tracker: onStart / onReset / setHeat
        WS->>Logger: logStart / logReset
        WS->>Clients: broadcast (preserved timestamp)
    else split
        WS->>Tracker: onSplit(lane, timestamp)
        alt accepted
            Tracker-->>WS: distance, splitNumber, isFinish, ranking
            WS->>Logger: logSplit
            WS->>Clients: broadcast enriched split + ranking
        else ignored (cooldown / after-finish)
            WS->>Logger: logIgnoredSplit
            Note over WS: not broadcast
        end
    else ping
        WS-->>Device: pong
    else device_register / update
        WS->>WS: update in-memory device map
        WS->>Clients: broadcast
    else other
        WS->>Clients: broadcast as-is
    end
```

The server preserves the original client `timestamp` on `start`, `split` and
`reset` messages so that every connected device sees the same race clock.
A `server_timestamp` field is added to every broadcast for debugging.

## Backend Layers

The backend follows a strict three-layer separation:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Routes** | `src/routes/routes.ts` | Single `registerRoutes()` function maps URLs to controllers. |
| **Controllers** | `src/controllers/**` | Thin HTTP adapters: parse request, call module, set status, send response. No business logic. |
| **Modules** | `src/modules/**` | Domain logic: competition data, split tracking, settings, tunnel. Pure and unit-testable. |
| **Middleware** | `src/middleware/**` | Cross-cutting concerns (tunnel route restriction). |
| **WebSockets** | `src/websockets/**` | Message contract, server setup, logger. `websocket.ts` is a thin adapter over `SplitTracker`. |

### Module responsibilities

- **`competition.ts`** — Reads and processes Lenex start lists, stores
  `data/competition.json`, and provides queries for sessions, events, heats,
  athletes and relays.
- **`splitTracker.ts`** — Per-heat state machine: cooldown filtering, distance
  labelling, finish detection, arrival ranking. Reads settings live via an
  injected loader.
- **`settings.ts`** — Loads/saves `config/app.json` (pool length, split
  cooldown). Cached in memory with per-field fallback to defaults.
- **`tunnel.ts`** — Spawns and manages the `cloudflared` process, persists
  `config/tunnel.json`, supports auto-start on boot.

## Frontend Layers

The frontend is plain browser JavaScript and static HTML/CSS (Tailwind v4).
There is no build step for the frontend; Tailwind is compiled ahead of time
into `public/css/output.css`.

```mermaid
graph TB
    subgraph Public
        Index[index.html Dashboard]
        Devices[devices.html Device Manager]
        Tunnel[tunnel.html Cloudflare Tunnel]
        SettingsPage[settings.html Settings]
    end

    subgraph Competition
        Remote[remote.html + remote.js]
        Screen[screen.html + screen.js]
        Log[log.html Competition Log]
        Upload[upload.html Lenex Upload]
    end

    subgraph SharedModules[public/js/modules]
        Socket[socket.js WebSocket + reconnect]
        TimeSync[timeSync.js NTP-style sync]
        Format[format.js time formatting]
    end

    subgraph AdminJS
        DevicesJS[devices.js]
        SettingsJS[settings.js]
        TunnelJS[tunnel.js]
    end

    Remote --> Socket
    Remote --> TimeSync
    Remote --> Format
    Screen --> Socket
    Screen --> TimeSync
    Devices --> Socket
    Devices --> DevicesJS
    SettingsPage --> SettingsJS
    Tunnel --> TunnelJS
```

### Shared browser modules

The frontend uses native ES modules. Shared modules live in `public/js/modules/`:

- `socket.js` — shared `WebSocket` with auto-reconnect; exports `send()`, `onSocketEvent()`.
- `timeSync.js` — `TimeSync` class (NTP-style offset calculation).
- `format.js` — `formatLapTime(ts, base)` and `pad(n)`.

Page entry points import from `../js/modules/*.js` and are loaded with
`<script type="module">`. See [frontend.md](frontend.md) for the full
module structure.

## Data Storage

All persistent state lives outside the source tree so Docker can bind-mount it:

| Path | Env override | Purpose |
|------|--------------|---------|
| `data/competition.json` | `DATA_DIR` | Processed Lenex competition data. |
| `config/app.json` | `CONFIG_DIR` | Application settings (pool length, cooldown). |
| `config/tunnel.json` | `CONFIG_DIR` | Cloudflare tunnel token and flags. |
| `logs/competition.log` | — | Append-only log of starts, resets, splits and ignored splits. |
| `uploads/` | — | Temporary storage for uploaded Lenex files (deleted after processing). |

`config/`, `data/`, `logs/` and `uploads/` are gitignored.

## Configuration

```mermaid
graph LR
    subgraph config/
        App[app.json]
        Tunnel[tunnel.json]
    end

    subgraph Env vars
        DATA[DATA_DIR]
        CFG[CONFIG_DIR]
        TUNNEL_TOK[TUNNEL_TOKEN]
        NODE_ENV[NODE_ENV]
    end

    App -->|read by| SettingsMod[settings.ts]
    Tunnel -->|read by| TunnelMod[tunnel.ts]
    DATA -->|used by| CompetitionMod[competition.ts]
    CFG -->|used by| SettingsMod
    CFG -->|used by| TunnelMod
    TUNNEL_TOK -->|docker-entrypoint.sh| Cloudflared
```

| Variable | Default | Used by |
|----------|---------|---------|
| `DATA_DIR` | `./data` | `competition.ts` (location of `competition.json`) |
| `CONFIG_DIR` | `./config` | `settings.ts`, `tunnel.ts` |
| `TUNNEL_TOKEN` | — | `docker-entrypoint.sh` starts cloudflared on boot if set |
| `NODE_ENV` | — | Express / Docker |

## Design Rules

1. **Controllers stay thin.** Parse request, call a module, map to HTTP status.
   No domain logic in controllers.
2. **Domain logic lives in modules.** Modules are pure, injectable and
   unit-tested without Express or WebSocket dependencies.
3. **Route registration is centralised** in `registerRoutes()`.
4. **`messageTypes.ts` is the WebSocket contract.** Adding or changing a
   message type requires updating both the type union and the client handlers.
5. **Backward compatibility.** Hardware devices keep sending bare
   `{ type, lane, timestamp }` split messages; the server enriches them.
   Older clients can ignore the extra fields.
6. **Tunnel restrictions are always enforced** before static serving and
   routing. Admin pages must remain blocked through Cloudflare by default.
7. **Static pages live under `public/`.** No server-side templating.
8. **Tests mirror source structure** under `test/`.

---

For message-level details see [websocket-api.md](websocket-api.md).
For REST endpoints see [http-api.md](http-api.md).
For the split-aware timing rules see [split-aware-timing.md](split-aware-timing.md).
