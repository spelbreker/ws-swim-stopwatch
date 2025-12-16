# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Cloudflare Tunnel: inline allowed routes in middleware (no external JSON)
- Cloudflare-only redirect from `/` and `/index.html` to `/competition/screen.html`
- Restrict tunnel to competition screen and essential assets/APIs
- Revert to spawn-based cloudflared process for stability
- Docs: update Cloudflare guide and README to match behavior
