# Webserver with WebSockets

This project is a web server with WebSocket support for stopwatch synchronization and split times. It includes a remote control interface and a display screen for showing split times.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Docker Setup](#docker-setup)
- [Using GitHub Packages](#using-github-packages)
- [External Access (Cloudflare Tunnel)](#external-access-cloudflare-tunnel)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [License](#license)

## Documentation

Full documentation lives in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [architecture.md](docs/architecture.md) | System architecture, request flow, layers, data storage, design rules |
| [http-api.md](docs/http-api.md) | Complete REST API reference |
| [websocket-api.md](docs/websocket-api.md) | WebSocket message contract and state diagrams |
| [split-aware-timing.md](docs/split-aware-timing.md) | Split labels, cooldown, finish detection, arrival ranking |
| [frontend.md](docs/frontend.md) | Page map, shared JS, page-by-page behaviour, layout convention |
| [deployment.md](docs/deployment.md) | Docker, environment variables, volumes, operations, CI |
| [cloudflare-tunnel.md](docs/cloudflare-tunnel.md) | Cloudflare Tunnel setup and route restrictions |
| [timesync.md](docs/timesync.md) | NTP-style time synchronisation between clients and server |
| [plan-split-aware-timing.md](docs/plan-split-aware-timing.md) | Original feature plan for split-aware timing |

## Overview

The project consists of a Node.js server that serves HTML files and manages WebSocket connections. The WebSocket connections are used to synchronize a stopwatch and split times between a remote control interface and a display screen.

## Features

- Start and reset a stopwatch from a remote interface.
- Display split times for multiple lanes on a screen.
- Real-time synchronization of stopwatch and split times using WebSockets.
- Split-aware timing: splits are labelled with the distance covered (50m, 100m, ...), lanes are
  ranked by completed splits and time, the finish is marked, and accidental double presses are
  filtered by a per-lane cooldown (ignored splits are logged).

## Getting Started

### Prerequisites

- Node.js (>= 22.0.0)
- Docker (optional, for containerized setup)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/your-username/webserver-with-websockets.git
    cd webserver-with-websockets
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Start the server:
    ```sh
    npm start
    ```

4. Open your browser and navigate to [http://localhost:8080](http://_vscodecontentref_/1).

## Usage

- **Remote Control Interface**: Open [http://localhost:8080/remote.html](http://_vscodecontentref_/2) to access the remote control interface. Use the buttons to start/reset the stopwatch and record split times.
- **Display Screen**: Open [http://localhost:8080/screen.html](http://_vscodecontentref_/3) to view the split times for each lane.
- **Settings**: Open [http://localhost:8080/settings.html](http://localhost:8080/settings.html) to set the pool length (25m/50m) and the split cooldown in seconds (default 12). Settings are stored in `config/app.json` and are only reachable locally (not via the Cloudflare tunnel). See [docs/websocket-api.md](docs/websocket-api.md#split-cooldown--ignored-splits) for how splits are labelled and filtered.

## Docker Setup

To run the project using Docker, follow these steps:

1. Build the Docker image:
    ```sh
    docker-compose build
    ```

2. Start the services:
    ```sh
    docker-compose up
    ```

3. Open your browser and navigate to [http://localhost:8080](http://_vscodecontentref_/4).

The compose file bind-mounts four host directories so data survives container rebuilds:
`uploads/` (raw Lenex uploads), `logs/`, `config/` (tunnel + app settings) and `data/`
(the processed `competition.json`). The data directory can be overridden with the `DATA_DIR`
environment variable (default `./data`).

### Docker with Cloudflare Tunnel

The Docker image includes cloudflared, allowing you to expose the server to the internet without port forwarding:

```sh
docker run -d \
  --name swim-stopwatch \
  -e TUNNEL_TOKEN=your-tunnel-token \
  ghcr.io/spelbreker/ws-swim-stopwatch:latest
```

See the [Cloudflare Tunnel Deployment Guide](docs/cloudflare-tunnel.md) for detailed setup instructions.

## Using GitHub Packages

To use the Docker image published to GitHub Packages, follow these steps:

1. Authenticate with GitHub Packages:
    ```sh
    echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
    ```

2. Pull the Docker image:
    ```sh
    docker pull ghcr.io/spelbreker/ws-swim-stopwatch:latest
    ```

3. Run the Docker container:
    ```sh
    docker run -p 8080:8080 ghcr.io/spelbreker/ws-swim-stopwatch:latest
    ```

4. Open your browser and navigate to [http://localhost:8080](http://_vscodecontentref_/5).

## External Access (Cloudflare Tunnel)

To expose the swim stopwatch to the internet (e.g., for viewing `/competition/screen.html` on mobile devices at a swim meet), you can use Cloudflare Tunnel. This is especially useful when:

- Running on a Raspberry Pi in a restricted network
- Port forwarding is not available
- You need external viewers to see real-time race data

See the [Cloudflare Tunnel Deployment Guide](docs/cloudflare-tunnel.md) for detailed setup instructions.

Security behavior when accessed via Cloudflare Tunnel:
- Redirects `/` and `/index.html` to `/competition/screen.html`.
- Only serves the competition screen and essential assets/APIs.
- Blocks admin pages (remote, upload, dashboard), training, and logs.

## Project Structure

The project uses a modular folder structure for clarity and maintainability:

```
project-root/
├── public/                  # Static assets (HTML, JS, CSS, images, manifest)
│   ├── competition/         # Competition remote, screen, log, upload pages
│   ├── training/            # Training remote and screen pages
│   ├── js/                  # Shared JS (main.js, timeSync.js, devices.js, settings.js)
│   ├── css/                 # Tailwind source (base.css) and compiled output (output.css)
│   ├── index.html           # Dashboard
│   ├── devices.html         # Device manager
│   ├── tunnel.html          # Cloudflare tunnel admin
│   ├── settings.html        # Application settings
│   └── manifest.json        # PWA manifest
├── src/                     # Server-side TypeScript source
│   ├── server.ts            # Server entry point (Express + HTTP + WebSocket on port 8080)
│   ├── routes/routes.ts     # Centralised route registration
│   ├── controllers/         # Thin HTTP adapters (competition, devices, tunnel, settings)
│   ├── modules/             # Domain logic (competition, splitTracker, settings, tunnel)
│   ├── middleware/          # tunnelRestriction middleware
│   ├── websockets/          # WebSocket server, message types, logger
│   └── types/               # Shared TypeScript types (competition, results)
├── test/                    # Jest tests mirroring src/ structure
├── docs/                    # Project documentation
├── uploads/                 # Temporary Lenex uploads (gitignored)
├── data/                    # Processed competition.json (gitignored, Docker volume)
├── config/                  # app.json + tunnel.json (gitignored, Docker volume)
├── logs/                    # competition.log (gitignored, Docker volume)
├── examples/                # Example Lenex files
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── package.json
├── tsconfig.json
└── AGENTS.md                # Guide for coding agents
```

### Key Points
- Server-side code is under `src/` with a strict routes → controllers → modules layering.
- Tests mirror the source structure under `test/`.
- Static assets remain in `public/` (no server-side templating).
- See [docs/architecture.md](docs/architecture.md) for the full layer breakdown.

> This structure improves maintainability, scalability, and testability.