"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDevicesList = getDevicesList;
const websocket_1 = require("../websockets/websocket");
// GET /devices - Get list of all devices (connected and disconnected)
function getDevicesList(_req, res) {
    try {
        const devices = (0, websocket_1.getDevices)();
        res.json({ devices });
    }
    catch (error) {
        console.error('[getDevicesList] Error:', error);
        res.status(500).json({ error: 'Failed to get devices list' });
    }
}
