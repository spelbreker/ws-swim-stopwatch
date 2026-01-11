"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTunnelStatus = getTunnelStatus;
exports.postTunnelStart = postTunnelStart;
exports.postTunnelStop = postTunnelStop;
exports.postTunnelConfig = postTunnelConfig;
exports.deleteTunnelConfig = deleteTunnelConfig;
const tunnel_1 = require("../modules/tunnel");
/**
 * Get tunnel status
 */
function getTunnelStatus(_req, res) {
    try {
        const status = (0, tunnel_1.getStatus)();
        res.json(status);
    }
    catch (error) {
        console.error('[getTunnelStatus] Error:', error);
        res.status(500).json({ error: 'Failed to get tunnel status' });
    }
}
/**
 * Start the tunnel
 */
function postTunnelStart(req, res) {
    try {
        const { token } = req.body || {};
        const result = (0, tunnel_1.startTunnel)(token);
        if (result.success) {
            res.json({ success: true, message: 'Tunnel started' });
        }
        else {
            res.status(400).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        console.error('[postTunnelStart] Error:', error);
        res.status(500).json({ error: 'Failed to start tunnel' });
    }
}
/**
 * Stop the tunnel
 */
function postTunnelStop(_req, res) {
    try {
        const result = (0, tunnel_1.stopTunnel)();
        if (result.success) {
            res.json({ success: true, message: 'Tunnel stopped' });
        }
        else {
            res.status(400).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        console.error('[postTunnelStop] Error:', error);
        res.status(500).json({ error: 'Failed to stop tunnel' });
    }
}
/**
 * Update tunnel configuration
 */
function postTunnelConfig(req, res) {
    try {
        const { token, autoStart, allowAllRoutes } = req.body || {};
        // If no token provided, try partial update (only for existing config)
        if (!token) {
            // Build partial update object from provided fields
            const updates = {};
            if (typeof autoStart === 'boolean') {
                updates.autoStart = autoStart;
            }
            if (typeof allowAllRoutes === 'boolean') {
                updates.allowAllRoutes = allowAllRoutes;
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid configuration fields provided' });
                return;
            }
            const result = (0, tunnel_1.updatePartialConfig)(updates);
            if (result.success) {
                res.json({ success: true, message: 'Configuration updated' });
            }
            else {
                res.status(400).json({ success: false, error: result.error });
            }
            return;
        }
        // Full config update with token
        if (typeof token !== 'string') {
            res.status(400).json({ error: 'Token must be a string' });
            return;
        }
        const result = (0, tunnel_1.updateConfig)(token, autoStart === true, allowAllRoutes === true);
        if (result.success) {
            res.json({ success: true, message: 'Configuration saved' });
        }
        else {
            res.status(500).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        console.error('[postTunnelConfig] Error:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
}
/**
 * Delete tunnel configuration
 */
function deleteTunnelConfig(_req, res) {
    try {
        const result = (0, tunnel_1.deleteConfig)();
        if (result.success) {
            res.json({ success: true, message: 'Configuration deleted' });
        }
        else {
            res.status(500).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        console.error('[deleteTunnelConfig] Error:', error);
        res.status(500).json({ error: 'Failed to delete configuration' });
    }
}
