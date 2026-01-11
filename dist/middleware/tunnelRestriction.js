"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tunnelRestrictionMiddleware = tunnelRestrictionMiddleware;
const tunnel_1 = require("../modules/tunnel");
/**
 * Default allowed routes when accessing via Cloudflare tunnel
 * These routes are accessible from external/public access
 */
const ALLOWED_TUNNEL_ROUTES = [
    // Competition screen and resources
    '/competition/screen.html',
    '/competition/screen.js',
    // Static assets
    '/css/',
    '/image/',
    '/js/main.js',
    '/js/timeSync.js',
    '/favicon.ico',
    // Read-only APIs for screen
    '/competition/event/',
    '/competition/summary',
    '/devices',
];
/**
 * Middleware to restrict access via Cloudflare tunnel to specific routes only
 * Local access (localhost, 127.0.0.1, private IPs) is always allowed
 */
function tunnelRestrictionMiddleware(req, res, next) {
    // Local IP available if needed for future logging
    // Check if request is from Cloudflare tunnel
    // Multiple ways to detect Cloudflare tunnel traffic:
    // 1. cf-connecting-ip header (set by Cloudflare)
    // 2. cf-ray header (Cloudflare request ID)
    // 3. X-Forwarded-For header from Cloudflare
    const cfConnectingIp = req.headers?.['cf-connecting-ip'];
    const cfRay = req.headers?.['cf-ray'];
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    const isFromCloudflare = !!(cfConnectingIp || cfRay || (xForwardedFor && xForwardedFor !== '127.0.0.1'));
    // Optional trace for Cloudflare-sourced requests (not noisy for locals)
    if (isFromCloudflare) {
        console.log(`[Tunnel] Request: ${req.method} ${req.path} (CF-Ray: ${cfRay}, CF-IP: ${cfConnectingIp})`);
    }
    // If not from Cloudflare (local access), allow everything
    if (!isFromCloudflare) {
        next();
        return;
    }
    // Get the requested path
    const requestedPath = req.path;
    // Check if tunnel restriction is disabled (allowAllRoutes = true)
    const config = (0, tunnel_1.loadConfig)();
    if (config?.allowAllRoutes === true) {
        console.log(`[Tunnel] Route restrictions disabled - allowing access to: ${requestedPath}`);
        next();
        return;
    }
    // For Cloudflare tunnel root access, redirect to competition screen
    if (requestedPath === '/' || requestedPath === '/index.html') {
        console.log(`[Tunnel] Redirecting Cloudflare request from ${requestedPath} to /competition/screen.html`);
        res.redirect('/competition/screen.html');
        return;
    }
    // Check if the requested path is allowed
    const isAllowed = ALLOWED_TUNNEL_ROUTES.some((allowedRoute) => {
        if (allowedRoute.endsWith('/')) {
            // Match paths starting with this prefix
            return requestedPath.startsWith(allowedRoute);
        }
        // Exact match
        return requestedPath === allowedRoute;
    });
    if (isAllowed) {
        next();
    }
    else {
        // Block access with 403 Forbidden
        console.log(`[Tunnel] Blocked request from Cloudflare: ${requestedPath} (CF-Ray: ${cfRay})`);
        res.status(403).send('Access to this resource via tunnel is not allowed');
    }
}
