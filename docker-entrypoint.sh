#!/bin/sh
set -e

# Handle graceful shutdown
cleanup() {
    if [ -n "$TUNNEL_PID" ]; then
        echo "Stopping Cloudflare Tunnel (entrypoint)..."
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# If TUNNEL_TOKEN env var is set, start cloudflared tunnel immediately
# This provides backward compatibility and quick-start capability
# Note: The web UI can also start/stop tunnels at runtime
if [ -n "$TUNNEL_TOKEN" ]; then
    echo "Starting Cloudflare Tunnel from environment variable..."
    cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" &
    TUNNEL_PID=$!
    echo "Cloudflare Tunnel started with PID $TUNNEL_PID"
    echo "Note: This tunnel is managed by the entrypoint. Use the web UI for runtime control."
fi

# Execute the main command
exec "$@"
