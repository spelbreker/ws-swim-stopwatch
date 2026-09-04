# Deployment & Operations

This document covers running ws-swim-stopwatch in development and production,
Docker setup, the Cloudflare Tunnel, environment variables, volumes, and
operational tasks.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Persistent Volumes](#persistent-volumes)
- [Cloudflare Tunnel](#cloudflare-tunnel)
- [Operational Tasks](#operational-tasks)
- [CI Checks](#ci-checks)
- [Security Notes](#security-notes)

## Prerequisites

- Node.js >= 22.0.0
- Docker (optional, for containerised deployment)
- A Cloudflare account and tunnel token (optional, for public access)

## Local Development

```sh
npm ci          # install dependencies
npm run build   # compile TypeScript to dist/
npm start       # run the compiled server on port 8080
```

For development with live reload:

```sh
npm run dev     # ts-node (unmaintained path, see package.json)
```

CSS rebuild during development:

```sh
npm run watch:css
```

The server listens on port **8080** (hard-coded in `src/server.ts`). Open
`http://localhost:8080` for the dashboard.

## Docker Deployment

### Build and run with Docker Compose

```sh
docker compose build
docker compose up
```

This builds the image from `Dockerfile` (Node.js 22 Alpine, `npm ci`,
`npm run build`) and starts the server on port 8080 with four bind-mounted
volumes for persistent data.

### Docker Compose services

| Service | Profile | Description |
|---------|---------|-------------|
| `node-server` | default | Production build, port 8080, persistent volumes |
| `node-server-dev` | `dev` | Live-reload dev container using Node 22 image |

```sh
# Development container
docker compose --profile dev up
```

### Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
```

### Entrypoint script

`docker-entrypoint.sh` handles two concerns:

1. **Graceful shutdown** — traps `SIGTERM`/`SIGINT` and kills the cloudflared
   child process if one was started by the entrypoint.
2. **Tunnel from env** — if `TUNNEL_TOKEN` is set, starts `cloudflared` in
   the background before running the main command. This is separate from the
   runtime tunnel management via the web UI.

### GitHub Packages

A prebuilt image is published to GitHub Container Registry:

```sh
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/spelbreker/ws-swim-stopwatch:latest
docker run -p 8080:8080 ghcr.io/spelbreker/ws-swim-stopwatch:latest
```

With a tunnel token:

```sh
docker run -d \
  --name swim-stopwatch \
  -e TUNNEL_TOKEN=your-tunnel-token \
  ghcr.io/spelbreker/ws-swim-stopwatch:latest
```

## Environment Variables

| Variable | Default | Used by | Description |
|----------|---------|---------|-------------|
| `DATA_DIR` | `./data` | `competition.ts` | Directory for `competition.json` |
| `CONFIG_DIR` | `./config` | `settings.ts`, `tunnel.ts` | Directory for `app.json` and `tunnel.json` |
| `TUNNEL_TOKEN` | — | `docker-entrypoint.sh` | Starts cloudflared on boot if set |
| `NODE_ENV` | — | Express, Docker | Standard Node environment |

## Persistent Volumes

The Docker Compose file bind-mounts four host directories so data survives
container rebuilds:

```yaml
volumes:
  - ./uploads:/app/uploads    # raw Lenex uploads (temp)
  - ./logs:/app/logs          # competition log
  - ./config:/app/config      # app.json + tunnel.json
  - ./data:/app/data          # competition.json
```

| Host path | Container path | Purpose |
|-----------|---------------|---------|
| `./uploads/` | `/app/uploads` | Temporary Lenex file uploads (deleted after processing) |
| `./logs/` | `/app/logs` | `competition.log` (append-only) |
| `./config/` | `/app/config` | `app.json` (settings), `tunnel.json` (tunnel config) |
| `./data/` | `/app/data` | `competition.json` (processed Lenex data) |

All four directories are gitignored. Docker creates them on first run if they
do not exist.

## Cloudflare Tunnel

The Cloudflare Tunnel exposes a restricted subset of the application to the
public internet over HTTPS without opening inbound ports. WebSockets work
through the tunnel automatically.

### Quick start

1. Create a tunnel in the Cloudflare Zero Trust dashboard and copy the token.
2. Open `http://localhost:8080/tunnel.html`.
3. Paste the token and click "Start".
4. Configure the tunnel's public hostname in the Cloudflare dashboard to
   point to `http://localhost:8080`.

Alternatively, set `TUNNEL_TOKEN` as an environment variable for Docker to
start the tunnel on boot.

### Tunnel restriction middleware

`src/middleware/tunnelRestriction.ts` runs before static serving and routing.
It detects Cloudflare-sourced requests via `cf-connecting-ip`, `cf-ray`, or
non-local `x-forwarded-for` headers.

- **Local access** (no Cloudflare headers) — all routes allowed.
- **Tunnel access** — only allowlisted routes are served; everything else
  returns `403 Forbidden`.
- **`allowAllRoutes: true`** in `config/tunnel.json` disables the allowlist
  (use with caution).

Default allowlist:

- `/competition/screen.html`, `/competition/screen.js`
- `/css/`, `/image/`
- `/js/main.js`, `/js/timeSync.js`
- `/favicon.ico`
- `/competition/event/`, `/competition/summary`
- `/devices`

Root (`/` and `/index.html`) is redirected to `/competition/screen.html`.

See [cloudflare-tunnel.md](cloudflare-tunnel.md) for the full guide.

## Operational Tasks

### Loading a competition

1. Export a Lenex `.lxf` or `.lef` file from SplashMe or your meet
   management software.
2. Open `http://localhost:8080/competition/upload.html`.
3. Upload the file. It is parsed and saved to `data/competition.json`.
4. The remote and screen will now show event/heat/athlete data.

### Changing pool length or cooldown

1. Open `http://localhost:8080/settings.html`.
2. Select 25 m or 50 m and set the cooldown (1–60 s).
3. Save. Settings take effect immediately (no restart needed).

### Downloading the competition log

- Open `http://localhost:8080/competition/log.html` and click "Download Log".
- Or: `curl -OJ "http://localhost:8080/logs/competition.log?download=1"`
- Filename format: `competition-YYYY-MM-DD-HH-MM-SS.log`

### Managing devices

- Open `http://localhost:8080/devices.html` to view, edit and monitor
  hardware devices.
- Devices register automatically over WebSocket on connect.
- Device state is in-memory and resets on server restart.

### Restarting the tunnel

- Use the tunnel page (`/tunnel.html`) to start/stop at runtime.
- Or restart the container (if `TUNNEL_TOKEN` is set, the entrypoint starts
  it automatically).

## CI Checks

PR CI runs:

```sh
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Run these locally before pushing substantial changes.

## Security Notes

- **Tunnel restriction** is the primary access control for public exposure.
  Admin pages, settings, upload, logs, and remote pages are blocked
  through Cloudflare by default.
- **Settings and tunnel config** are stored in `config/` (gitignored). Do not
  commit tokens.
- **Device state** is in-memory only; no persistent device database.
- **Uploaded Lenex files** are deleted immediately after processing.
- **Competition log** may contain lane numbers and timestamps but no
  personal data beyond what is in the Lenex file.
- See [AGENTS.md §11](../AGENTS.md) for the accepted `fast-xml-parser`
  vulnerability note.
