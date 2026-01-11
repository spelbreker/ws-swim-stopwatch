# Copilot Processing - Tunnel Page Restriction Toggle

## User Request
I want the tunnel page to get a selectable option to temporarily make the restricted routes accessible in the tunnel. By default it should be closed.

## Translation from Dutch
"ik wil de tunnel pagina een selecteerbare optie bij krijgt om tijdelijk de restricted routes toegangelijk te maken bij de tunel. standaard moet die dicht zitten"

## Problem Analysis
The user wants to add a feature to the tunnel configuration page (`/public/tunnel.html`) that allows temporarily disabling the route restrictions enforced by the `tunnelRestrictionMiddleware`. Currently, the middleware blocks access to certain routes (like `/competition/remote.html`, `/competition/upload.html`, etc.) when accessed via Cloudflare tunnel. The user wants the ability to toggle this restriction on/off from the tunnel page, with the default state being "closed" (restricted).

## Current System Understanding
1. **Tunnel Restriction Middleware** (`src/middleware/tunnelRestriction.ts`): Blocks access to sensitive routes when requests come from Cloudflare tunnel
2. **Tunnel Configuration** (`public/tunnel.html`): Provides UI to configure and control the Cloudflare tunnel
3. **Tunnel Module** (`src/modules/tunnel.ts`): Manages tunnel lifecycle and configuration
4. **Tunnel Controller** (`src/controllers/tunnelController.ts`): Handles API requests for tunnel management

## Implementation Plan
1. Add a new configuration option `allowAllRoutes` to the tunnel configuration (default: false)
2. Update the tunnel module to store and retrieve this setting
3. Update the tunnel controller to handle the new configuration option
4. Update the tunnel restriction middleware to check this setting and allow all routes when enabled
5. Update the tunnel.html UI to include a toggle for this option
6. Add tests to verify the new functionality

## Files to Modify
- `/home/runner/work/ws-swim-stopwatch/ws-swim-stopwatch/src/modules/tunnel.ts`
- `/home/runner/work/ws-swim-stopwatch/ws-swim-stopwatch/src/controllers/tunnelController.ts`
- `/home/runner/work/ws-swim-stopwatch/ws-swim-stopwatch/src/middleware/tunnelRestriction.ts`
- `/home/runner/work/ws-swim-stopwatch/ws-swim-stopwatch/public/tunnel.html`
- `/home/runner/work/ws-swim-stopwatch/ws-swim-stopwatch/test/middleware/tunnelRestriction.test.ts`

## Date
2026-01-11
