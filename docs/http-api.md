# HTTP API Reference

All endpoints are registered in `src/routes/routes.ts` via the single
`registerRoutes(app, upload)` function. Responses are JSON unless noted
otherwise. The tunnel restriction middleware (`src/middleware/tunnelRestriction.ts`)
runs before routing; endpoints marked **tunnel-blocked** are only reachable
from localhost / private IPs.

## Table of Contents

- [Competition](#competition)
- [Settings](#settings)
- [Tunnel](#tunnel)
- [Devices](#devices)
- [Logs](#logs)
- [Static Pages](#static-pages)
- [Status Codes](#status-codes)

## Competition

### `POST /competition/upload`

Upload a Lenex start list (`.lxf` / `.lef`). The file is parsed by
`js-lenex`, validated, and written to `data/competition.json`. The uploaded
temp file is deleted after processing.

- **Tunnel-blocked.**
- **Content-Type:** `multipart/form-data`
- **Form field:** `lenexFile` — the Lenex file
- **Success:** `302` redirect to `/competition/upload.html`
- **Errors:**
  - `400` — no file uploaded
  - `500` — parse or write error (message body contains details)

```sh
curl -F lenexFile=@startlist.lxf http://localhost:8080/competition/upload
```

### `GET /competition/summary`

Returns a high-level summary of the loaded meet.

- **Tunnel-allowed.**
- **Query params:**
  - `meet` (optional, default `0`) — meet index
  - `session` (optional) — session number (1-based); defaults to first session
- **200 response:**

```json
{
  "meet": "AZC Kampioenschappen 2025",
  "first_session_date": "2025-06-14",
  "session_count": 3,
  "event_count": 42,
  "club_count": 12
}
```

- **500** — no competition loaded or error reading data

### `GET /competition/sessions`

Returns all sessions for a meet.

- **Tunnel-blocked.**
- **Query params:** `meet` (optional, default `0`)
- **200 response:** array of `CompetitionSession` objects:

```json
[
  { "date": "2025-06-14", "number": 1, "events": [ ... ] }
]
```

### `GET /competition/event`

Returns all events in a session.

- **Tunnel-allowed.**
- **Query params:**
  - `meet` (optional, default `0`)
  - `session` (optional) — session number; defaults to first session
- **200 response:** array of `CompetitionEvent` objects (see
  [Types](#types) below).

### `GET /competition/event/:event`

Returns a single event by event number.

- **Tunnel-allowed.**
- **Path params:** `event` — event number (1-based)
- **Query params:** `meet`, `session` (same as above)
- **200:** `CompetitionEvent` object
- **404:** event not found or missing event number
- **500:** error reading data

### `GET /competition/event/:event/heat/:heat`

Returns the entries (athletes or relay teams) for a specific heat, sorted by
lane. Relay events (`relaycount > 1`) automatically return relay entries with
team member names.

- **Tunnel-allowed.**
- **Path params:** `event`, `heat` (both 1-based)
- **Query params:** `meet`, `session`
- **200 response (individual event):**

```json
[
  {
    "lane": 1,
    "entrytime": "PT1M02.34S",
    "club": "AZC",
    "athletes": [
      { "athleteid": 101, "firstname": "Jan", "lastname": "Jansen", "birthdate": "2005-03-12" }
    ]
  }
]
```

- **200 response (relay event):**

```json
[
  {
    "lane": 2,
    "entrytime": "PT4M10.00S",
    "club": "AZC",
    "relayid": "R1",
    "athletes": [
      { "athleteid": 101, "firstname": "Jan", "lastname": "Jansen" },
      { "athleteid": 102, "firstname": "Piet", "lastname": "Pieters" }
    ]
  }
]
```

- **400:** missing event or heat number
- **404:** heat or entries not found
- **500:** error reading data

### `GET /competition/delete`

Deletes the processed `data/competition.json`. Does not delete uploaded files
or other data.

- **Tunnel-blocked.**
- **200:** `"Competition deleted"`
- **500:** error deleting

## Settings

### `GET /settings`

Returns the current application settings (cached in memory, loaded from
`config/app.json`).

- **Tunnel-blocked.**
- **200 response:**

```json
{ "poolLength": 25, "splitCooldownSec": 12 }
```

### `POST /settings`

Updates and persists application settings. The in-memory cache is refreshed
on save.

- **Tunnel-blocked.**
- **Content-Type:** `application/json`
- **Body:**

```json
{ "poolLength": 50, "splitCooldownSec": 15 }
```

- **Validation:**
  - `poolLength` must be `25` or `50`
  - `splitCooldownSec` must be an integer between `1` and `60`
- **200 response:**

```json
{ "success": true, "settings": { "poolLength": 50, "splitCooldownSec": 15 } }
```

- **400:** validation error (field-specific message)
- **500:** failed to save

## Tunnel

All tunnel routes use the `json()` body parser (registered at `/tunnel`).
They are **tunnel-blocked** by default.

### `GET /tunnel/status`

Returns the current Cloudflare tunnel status.

```json
{
  "running": true,
  "pid": 12345,
  "token": "***abcdefgh",
  "autoStart": false,
  "allowAllRoutes": false,
  "url": null,
  "connectionInfo": null,
  "error": null
}
```

### `POST /tunnel/start`

Starts the cloudflared process. If a `token` is provided in the body it is
saved to `config/tunnel.json`; otherwise the stored token is used.

- **Body (optional):** `{ "token": "your-tunnel-token" }`
- **200:** `{ "success": true, "message": "Tunnel started" }`
- **400:** tunnel already running or no token configured

### `POST /tunnel/stop`

Stops the running cloudflared process (sends `SIGTERM`).

- **200:** `{ "success": true, "message": "Tunnel stopped" }`
- **400:** tunnel is not running

### `POST /tunnel/config`

Full or partial configuration update.

- **Full update (with token):**

```json
{ "token": "new-token", "autoStart": true, "allowAllRoutes": false }
```

- **Partial update (without token, requires existing config):**

```json
{ "autoStart": true }
```

- **200:** `{ "success": true, "message": "Configuration saved" }`
- **400:** no valid fields / token must be a string / no existing config
- **500:** failed to save

### `DELETE /tunnel/config`

Deletes `config/tunnel.json`.

- **200:** `{ "success": true, "message": "Configuration deleted" }`
- **500:** failed to delete

## Devices

### `GET /devices`

Returns all registered hardware devices (connected and disconnected). Device
state is in-memory and resets on server restart.

- **Tunnel-allowed.**
- **200 response:**

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
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `mac` | string | Device MAC address |
| `ip` | string | Device IP address |
| `role` | `"starter"` \| `"lane"` | Device role |
| `lane` | number? | Lane number (lane devices only) |
| `connected` | boolean | Current WebSocket connection status |
| `lastSeen` | number | Timestamp of last activity (ms since epoch) |

## Logs

### `GET /logs/competition.log`

Returns the raw competition log file as `text/plain`.

- **Tunnel-blocked.**
- **Query params:**
  - `download` — if present (any value), adds
    `Content-Disposition: attachment; filename="competition-YYYY-MM-DD-HH-MM-SS.log"`
- **200:** log file contents
- **404:** log file not found

```sh
# View in browser
curl http://localhost:8080/logs/competition.log

# Download
curl -OJ "http://localhost:8080/logs/competition.log?download=1"
```

## Static Pages

All files under `public/` are served by `express.static`. The following HTML
pages are the main entry points:

| Path | Page | Tunnel access |
|------|------|---------------|
| `/` or `/index.html` | Dashboard | redirected to `/competition/screen.html` |
| `/competition/remote.html` | Competition Remote | blocked |
| `/competition/screen.html` | Competition Screen | allowed |
| `/competition/upload.html` | Lenex Upload | blocked |
| `/competition/log.html` | Competition Log | blocked |
| `/devices.html` | Device Manager | blocked |
| `/tunnel.html` | Cloudflare Tunnel | blocked |
| `/settings.html` | Settings | blocked |
| `/training/training-remote.html` | Training Remote | blocked |
| `/training/training-screen.html` | Training Screen | blocked |

See [cloudflare-tunnel.md](cloudflare-tunnel.md) for the full tunnel allowlist.

## Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `302` | Redirect (used by upload) |
| `400` | Bad request — validation error or missing required field |
| `403` | Blocked by tunnel restriction middleware |
| `404` | Resource not found |
| `500` | Server error — see response body for details |

## Types

The competition data types are defined in `src/types/competition-types.ts`
and re-export the Lenex enums. Key shapes:

```typescript
interface CompetitionEvent {
  number: number;
  order: number;
  eventid: string;
  gender: Gender;
  swimstyle: { relaycount: number; stroke: Stroke; distance: number };
  heats: CompetitionHeat[];
}
```

The `swimstyle.distance * swimstyle.relaycount` product is used by the split
tracker to compute total race distance and expected splits. See
[split-aware-timing.md](split-aware-timing.md) for details.
