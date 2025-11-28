#!/bin/sh
set -e

# Handle graceful shutdown
cleanup() {
    if [ -n "$TUNNEL_PID" ]; then
        echo "Stopping Cloudflare Tunnel..."
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# If TUNNEL_TOKEN is set, start cloudflared tunnel in background
if [ -n "$TUNNEL_TOKEN" ]; then
    echo "Starting Cloudflare Tunnel..."
    cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" &
    TUNNEL_PID=$!
    echo "Cloudflare Tunnel started with PID $TUNNEL_PID"
fi

# Execute the main command
exec "$@"
