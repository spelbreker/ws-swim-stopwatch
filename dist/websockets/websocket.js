"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSplitTracker = getSplitTracker;
exports.resetSplitTracker = resetSplitTracker;
exports.getDevices = getDevices;
exports.setupWebSocket = setupWebSocket;
const ws_1 = __importStar(require("ws"));
const logger_1 = require("./logger");
const settings_1 = require("../modules/settings");
const splitTracker_1 = require("../modules/splitTracker");
// Store device information
const devices = new Map();
// Per-heat split state (cooldown, distance labels, ranking)
let splitTracker = new splitTracker_1.SplitTracker(settings_1.loadSettings);
function getSplitTracker() {
    return splitTracker;
}
function resetSplitTracker() {
    splitTracker = new splitTracker_1.SplitTracker(settings_1.loadSettings);
}
function toNumber(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
}
function applyHeatFromMessage(msg) {
    const event = toNumber(msg.event);
    const heat = toNumber(msg.heat);
    if (event === undefined || heat === undefined)
        return;
    splitTracker.setHeat((0, splitTracker_1.computeHeatInfo)(event, heat, toNumber(msg.session), (0, settings_1.loadSettings)().poolLength));
}
function isMessage(obj) {
    return (typeof obj === 'object'
        && obj !== null
        && 'type' in obj);
}
function broadcastAllClients(wss, payload) {
    const withTimestamp = {
        ...(typeof payload === 'object' && payload !== null ? payload : {}),
        server_timestamp: Date.now(),
    };
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(JSON.stringify(withTimestamp));
        }
    });
}
function handleStart(msg, wss) {
    const { event, heat, timestamp } = msg;
    if ((typeof timestamp === 'number')
        && (typeof event === 'string' || typeof event === 'number')
        && (typeof heat === 'string' || typeof heat === 'number')) {
        (0, logger_1.logStart)(event, heat, timestamp);
    }
    // Defensive: a starter may send start without a preceding event-heat
    const current = splitTracker.getHeat();
    if (!current || current.event !== toNumber(event) || current.heat !== toNumber(heat)) {
        applyHeatFromMessage(msg);
    }
    splitTracker.onStart();
    // Preserve the original client timestamp - don't overwrite with server time
    const payload = {
        ...msg,
        // timestamp: original timestamp is preserved
    };
    broadcastAllClients(wss, payload);
}
function handleSplit(msg, wss) {
    const lane = toNumber(msg.lane);
    const { timestamp, elapsed_ms } = msg;
    if (lane === undefined || typeof timestamp !== 'number') {
        // Malformed split: keep legacy behaviour and just relay it
        broadcastAllClients(wss, msg);
        return;
    }
    const result = splitTracker.onSplit(lane, timestamp);
    if (!result.accepted) {
        (0, logger_1.logIgnoredSplit)(lane, timestamp, result.reason, result.msSinceLast);
        return;
    }
    const { distance, splitNumber, isFinish, ranking } = result;
    (0, logger_1.logSplit)(lane, timestamp, typeof elapsed_ms === 'number' ? elapsed_ms : undefined, distance, splitNumber);
    // Preserve the original client timestamp - don't overwrite with server time
    broadcastAllClients(wss, {
        ...msg,
        lane,
        distance,
        splitNumber,
        isFinish,
        ranking,
    });
}
function handleEventHeat(msg, wss) {
    console.log(`[WebSocket] Event/Heat changed: event=${msg.event}, heat=${msg.heat}`);
    applyHeatFromMessage(msg);
    broadcastAllClients(wss, msg);
}
function handleReset(msg, wss) {
    const timestamp = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now();
    (0, logger_1.logReset)(timestamp);
    splitTracker.onReset();
    // Preserve the original client timestamp - don't overwrite with server time
    const payload = {
        ...msg,
        timestamp,
    };
    broadcastAllClients(wss, payload);
}
function handlePing(msg, ws) {
    if (typeof msg.time === 'number') {
        ws.send(JSON.stringify({
            type: 'pong',
            client_ping_time: msg.time,
            server_time: Date.now(),
        }));
    }
}
function handleDeviceRegister(msg, ws, wss) {
    const { ip, mac, role, lane } = msg;
    if (typeof ip === 'string'
        && typeof mac === 'string'
        && (role === 'starter' || role === 'lane')) {
        const deviceInfo = {
            mac,
            ip,
            role,
            lane: typeof lane === 'number' ? lane : undefined,
            connected: true,
            lastSeen: Date.now(),
            ws,
        };
        devices.set(mac, deviceInfo);
        console.log(`[WebSocket] Device registered: ${mac} (${role})`);
        // Broadcast device registration to all clients
        broadcastAllClients(wss, msg);
    }
}
function handleDeviceUpdateRole(msg) {
    const { mac, role } = msg;
    if (typeof mac === 'string'
        && (role === 'starter' || role === 'lane')) {
        const device = devices.get(mac);
        if (device) {
            device.role = role;
            device.lastSeen = Date.now();
            console.log(`[WebSocket] Device role updated: ${mac} -> ${role}`);
        }
    }
}
function handleDeviceUpdateLane(msg) {
    const { mac, lane } = msg;
    if (typeof mac === 'string'
        && typeof lane === 'number') {
        const device = devices.get(mac);
        if (device) {
            device.lane = lane;
            device.lastSeen = Date.now();
            console.log(`[WebSocket] Device lane updated: ${mac} -> ${lane}`);
        }
    }
}
function getDevices() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Array.from(devices.values()).map(({ ws, ...device }) => device);
}
function setupWebSocket(server) {
    const wss = new ws_1.WebSocketServer({ server });
    const clientLiveness = new Map();
    wss.on('connection', (ws) => {
        clientLiveness.set(ws, true);
        ws.on('pong', () => {
            clientLiveness.set(ws, true);
        });
        ws.on('message', (message) => {
            let msg;
            try {
                msg = JSON.parse(message);
            }
            catch {
                return;
            }
            if (!isMessage(msg))
                return;
            const msgObj = msg;
            switch (msgObj.type) {
                case 'ping':
                    handlePing(msgObj, ws);
                    return;
                case 'device_register':
                    handleDeviceRegister(msgObj, ws, wss);
                    return;
                case 'device_update_role':
                    handleDeviceUpdateRole(msgObj);
                    broadcastAllClients(wss, msgObj);
                    return;
                case 'device_update_lane':
                    handleDeviceUpdateLane(msgObj);
                    broadcastAllClients(wss, msgObj);
                    return;
                case 'start':
                    handleStart(msgObj, wss);
                    return;
                case 'split':
                    handleSplit(msgObj, wss);
                    return;
                case 'reset':
                    handleReset(msgObj, wss);
                    return;
                case 'select-event':
                    // Backward compatibility: map select-event to event-heat
                    msgObj.type = 'event-heat';
                // falls through
                case 'event-heat':
                    handleEventHeat(msgObj, wss);
                    return;
                case 'clear':
                    console.log('[WebSocket] Clear display');
                    broadcastAllClients(wss, msgObj);
                    return;
                default:
                    console.log(`[WebSocket] Unknown message type: ${msgObj.type}`);
                    break;
            }
            // Default: broadcast other messages as-is
            broadcastAllClients(wss, msgObj);
        });
        ws.on('close', () => {
            clientLiveness.delete(ws);
            // Mark device as disconnected
            for (const [mac, device] of devices.entries()) {
                if (device.ws === ws) {
                    device.connected = false;
                    device.lastSeen = Date.now();
                    device.ws = undefined;
                    console.log(`[WebSocket] Device disconnected: ${mac}`);
                    break;
                }
            }
            console.log('WebSocket connection closed');
        });
    });
    const heartbeat = setInterval(() => {
        wss.clients.forEach((client) => {
            if (!clientLiveness.get(client)) {
                client.terminate();
                clientLiveness.delete(client);
            }
            else {
                clientLiveness.set(client, false);
                client.ping();
            }
        });
    }, 30000);
    // Periodically broadcast time_sync to all clients
    const timeSync = setInterval(() => {
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ type: 'time_sync', server_time: Date.now() }));
            }
        });
    }, 5000);
    wss.on('close', () => {
        clearInterval(heartbeat);
        clearInterval(timeSync);
        clientLiveness.clear();
    });
    // Shut down the WebSocket server (and its timers) together with the HTTP server
    server.on('close', () => wss.close());
    return wss;
}
