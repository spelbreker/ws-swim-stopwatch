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

## Implementation Summary

### Changes Made

1. **Backend Changes:**
   - Added `allowAllRoutes` boolean field to `TunnelConfig` and `TunnelStatus` interfaces
   - Updated `tunnel.ts` module to store and retrieve the `allowAllRoutes` setting (defaults to `false`)
   - Modified `updateConfig()` function to accept and save the new parameter
   - Updated tunnel controller to handle the new `allowAllRoutes` parameter in POST requests
   - Modified tunnel restriction middleware to check the config and bypass restrictions when `allowAllRoutes` is `true`

2. **Frontend Changes:**
   - Added a new checkbox in `tunnel.html` for "Allow access to all routes via tunnel (temporarily disable restrictions)"
   - Updated status display to show route restriction state (Enabled/Disabled with visual distinction)
   - Modified `saveConfig()` JavaScript function to include the `allowAllRoutes` parameter
   - Updated `updateUI()` function to display and sync the checkbox state with server status

3. **Testing:**
   - Added comprehensive tests for the new functionality in `tunnelRestriction.test.ts`
   - Updated `tunnelController.test.ts` to test the new configuration parameter
   - All 98 tests pass successfully

### Feature Behavior

- **Default State:** Route restrictions are enabled (restricted mode) - this is the secure default
- **When Enabled:** The `allowAllRoutes` checkbox allows administrators to temporarily disable route restrictions, making all routes accessible via the Cloudflare tunnel
- **Visual Feedback:** The status section clearly shows whether restrictions are enabled or disabled with appropriate color coding (orange/yellow for disabled state)
- **Security:** Only accessible from the local tunnel configuration page, not from the tunnel itself

### Screenshots

1. **Default State (Restrictions Enabled):**
   ![Default State](https://github.com/user-attachments/assets/f2e5ff71-171e-4eb8-8b6e-73d68b086d8c)

2. **Restrictions Disabled State:**
   ![Restrictions Disabled](https://github.com/user-attachments/assets/7e403622-701c-4b4e-8dc6-b7d5b6a7d718)

## Verification

- ✅ Build successful (TypeScript compilation)
- ✅ All 98 tests passing
- ✅ Linter passes with no errors
- ✅ Manual UI testing completed
- ✅ Feature works as expected: checkbox toggles route restrictions
- ✅ Default state is secure (restrictions enabled)
