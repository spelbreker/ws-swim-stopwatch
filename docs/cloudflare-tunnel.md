# Cloudflare Tunnel Deployment Guide

This guide explains how to expose the ws-swim-stopwatch server to the internet using Cloudflare Tunnel. This is ideal for scenarios where:

- You're running on a Raspberry Pi in a restricted network
- Port forwarding is not available
- You need to expose specific pages (like `/competition/screen.html`) to external viewers
- WebSocket connections need to work through the tunnel

## Overview

Cloudflare Tunnel creates a secure outbound connection from your server to Cloudflare's edge network. This means:

- No inbound ports need to be opened
- Traffic flows securely over HTTPS
- WebSockets work out-of-the-box
- You can restrict access to specific paths

## Deployment Options

There are two ways to run the Cloudflare Tunnel:

1. **Docker (Recommended)** - Tunnel runs inside the container, OS-independent
2. **Native Installation** - Tunnel runs on the host OS (Raspberry Pi)

## Prerequisites

- A Cloudflare account (free tier works)
- A domain managed by Cloudflare DNS
- Docker installed (for containerized setup) OR Raspberry Pi/Linux server (for native setup)

---

## Option A: Docker Deployment (Recommended)

The Docker image includes cloudflared, making it easy to run the tunnel without installing anything on the host OS.

### 1. Create a Tunnel in Cloudflare Dashboard

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** connector
5. Name your tunnel (e.g., `swim-stopwatch`)
6. Copy the tunnel token (starts with `eyJ...`)

### 2. Configure DNS

In the tunnel configuration, add a public hostname:
- **Subdomain**: `screen` (or your choice)
- **Domain**: Select your domain
- **Service**: `http://localhost:8080`

### 3. Run with Docker

```bash
# Pull the latest image
docker pull ghcr.io/spelbreker/ws-swim-stopwatch:latest

# Run with tunnel enabled
docker run -d \
  --name swim-stopwatch \
  -e TUNNEL_TOKEN=eyJhIjoiYWJjZDEyMzQ... \
  -v $(pwd)/uploads:/app/uploads \
  ghcr.io/spelbreker/ws-swim-stopwatch:latest
```

### 4. Run with Docker Compose

Edit `docker-compose.yml` and uncomment the `TUNNEL_TOKEN` line:

```yaml
services:
  node-server:
    build: .
    environment:
      - TUNNEL_TOKEN=eyJhIjoiYWJjZDEyMzQ...
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Then start:

```bash
docker-compose up -d
```

### Verify the Tunnel

Check if the tunnel is connected:

```bash
# View container logs
docker logs swim-stopwatch

# You should see:
# Starting Cloudflare Tunnel...
# Cloudflare Tunnel started with PID ...
```

Visit `https://screen.yourdomain.com/competition/screen.html` to verify it works.

---

## Option B: Native Installation (Raspberry Pi)

If you prefer to run cloudflared directly on the host OS instead of in Docker.

### 1. Install cloudflared

```bash
# Update package list
sudo apt-get update

# Download cloudflared for ARM64 (Raspberry Pi 4/5)
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb

# For older Raspberry Pi (ARM32/ARMv7), use:
# curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-armhf.deb -o cloudflared.deb

# Install the package
sudo dpkg -i cloudflared.deb

# Verify installation
cloudflared --version
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser URL. Log in to your Cloudflare account and authorize the connection for your domain.

### 3. Create a Tunnel

```bash
cloudflared tunnel create swim-stopwatch
```

Note the Tunnel UUID that is returned (e.g., `a1b2c3d4-e5f6-7890-abcd-1234567890ab`).

### 4. Configure DNS Route

```bash
# Replace with your actual subdomain and domain
cloudflared tunnel route dns swim-stopwatch screen.yourdomain.com
```

This creates a CNAME record pointing your subdomain to the tunnel.

## Configuration

### 5. Create the Tunnel Configuration

Create the configuration file at `/etc/cloudflared/config.yml`:

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Add the following configuration:

```yaml
tunnel: swim-stopwatch
credentials-file: /home/pi/.cloudflared/<TUNNEL-UUID>.json

ingress:
  # Allow all paths for simplicity (recommended for single-hostname setups)
  # The screen, assets, WebSocket, and API are all served from the same hostname
  - hostname: screen.yourdomain.com
    service: http://localhost:8080
  
  # Catch-all: reject requests to any other hostname
  - service: http_status:404
```

> **Note:** This configuration exposes all paths under the hostname. If you want to restrict access to only specific paths (e.g., only `/competition/screen.html`), see the "Path-Restricted Configuration" section below.

Replace:
- `<TUNNEL-UUID>` with your actual tunnel UUID (shown when you ran `cloudflared tunnel create`)
- `screen.yourdomain.com` with your actual subdomain
- `/home/pi/` with your actual home directory (check with `echo $HOME`)

### Path-Restricted Configuration (Optional)

If you want to expose only the screen view and block access to the remote control interface:

```yaml
tunnel: swim-stopwatch
credentials-file: /home/pi/.cloudflared/<TUNNEL-UUID>.json

ingress:
  # Competition screen and required assets
  - hostname: screen.yourdomain.com
    path: ^/competition/screen\.(html|js)$
    service: http://localhost:8080
  
  - hostname: screen.yourdomain.com
    path: ^/(css|images?|js)/.*$
    service: http://localhost:8080
  
  # WebSocket and API endpoints
  - hostname: screen.yourdomain.com
    path: ^/(ws|api)/.*$
    service: http://localhost:8080
  
  # Reject everything else
  - service: http_status:404
```

> **Note:** Path patterns use regular expressions when starting with `^`.

## Running the Tunnel

### Manual Start (for testing)

```bash
cloudflared tunnel run swim-stopwatch
```

### Install as System Service

For automatic startup on boot:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Check the status:

```bash
sudo systemctl status cloudflared
```

View logs:

```bash
sudo journalctl -u cloudflared -f
```

## WebSocket Configuration

WebSockets are supported by default in Cloudflare Tunnel. No additional configuration is needed.

The client-side JavaScript (`screen.js`) will automatically connect to the WebSocket endpoint. Make sure:

1. The WebSocket URL in `screen.js` uses `wss://` when accessed via the tunnel
2. The `/ws` path is included in the ingress rules

### Client-Side WebSocket URL

The existing JavaScript in `screen.js` should work correctly as it constructs the WebSocket URL dynamically based on the current page location.

## Security Recommendations

### Protect Sensitive Paths with Cloudflare Access

To protect the remote control interface while keeping the screen public:

1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Create a new application
3. Set the application domain to `screen.yourdomain.com`
4. Add a path rule for `/competition/remote.html` and `/training/*`
5. Configure authentication (email, SSO, etc.)

### Limit Access by IP/Country

In Cloudflare Dashboard → Security → WAF:
- Create firewall rules to restrict access by country or IP range
- Block known bad actors

## Troubleshooting

### Docker Tunnel Issues

```bash
# Check container logs
docker logs swim-stopwatch

# Verify tunnel token is set
docker exec swim-stopwatch printenv TUNNEL_TOKEN

# Test if server is responding inside container
docker exec swim-stopwatch curl -s http://localhost:8080/competition/screen.html | head

# Restart container
docker restart swim-stopwatch
```

### Native Installation - Connection Issues

```bash
# Check tunnel status
cloudflared tunnel info swim-stopwatch

# Test local server
curl http://localhost:8080/competition/screen.html

# Check DNS resolution
dig screen.yourdomain.com
```

### WebSocket Not Connecting

1. Verify the `/ws` path is accessible through the tunnel
2. Check browser console for connection errors
3. Ensure the local server is running and accessible
4. For Docker: check that port 8080 is exposed correctly

### Service Won't Start (Native Installation)

```bash
# Check configuration syntax
cloudflared tunnel ingress validate

# View detailed logs
sudo journalctl -u cloudflared -n 100
```

## Alternative Solutions

### Tailscale Funnel

If you prefer Tailscale:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Enable Funnel
tailscale funnel 8080
```

Note: Tailscale Funnel URLs are less customizable.

### ngrok

For quick testing (not recommended for production):

```bash
ngrok http 8080
```

### Reverse SSH Tunnel

If you have access to a VPS:

```bash
# Use a non-privileged port (recommended)
ssh -R 8080:localhost:8080 user@your-vps.com

# Or let SSH choose an available port
ssh -R 0:localhost:8080 user@your-vps.com
```

> **Note:** Using port 80 requires root privileges and may conflict with existing web servers.

## Complete Setup Checklist

### Docker Setup
- [ ] Cloudflare account created
- [ ] Tunnel created in Zero Trust Dashboard
- [ ] Tunnel token copied
- [ ] DNS hostname configured in tunnel settings
- [ ] Docker container started with `TUNNEL_TOKEN` environment variable
- [ ] Tunnel connection verified in logs
- [ ] WebSocket connection verified
- [ ] (Optional) Cloudflare Access configured for sensitive paths

### Native Installation Setup
- [ ] Cloudflared installed on Raspberry Pi
- [ ] Authenticated with Cloudflare account
- [ ] Tunnel created and UUID noted
- [ ] DNS route configured
- [ ] `/etc/cloudflared/config.yml` created
- [ ] Tunnel tested manually
- [ ] System service installed and enabled
- [ ] WebSocket connection verified
- [ ] (Optional) Cloudflare Access configured for sensitive paths

## Related Documentation

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [WebSocket API Documentation](./websocket-api.md)
- [Time Synchronization](./timesync.md)
