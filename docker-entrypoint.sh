#!/bin/sh
set -e

# If TUNNEL_TOKEN is set, start cloudflared tunnel in background
if [ -n "$TUNNEL_TOKEN" ]; then
    echo "Starting Cloudflare Tunnel..."
    cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" &
    TUNNEL_PID=$!
    echo "Cloudflare Tunnel started with PID $TUNNEL_PID"
fi

# Execute the main command
exec "$@"
