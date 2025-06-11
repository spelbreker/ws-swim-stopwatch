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
exports.setupWebSocket = setupWebSocket;
const ws_1 = __importStar(require("ws"));
const logger_1 = require("./logger");
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
    const { event, heat, time } = msg;
    if ((typeof time === 'number')
        && (typeof event === 'string' || typeof event === 'number')
        && (typeof heat === 'string' || typeof heat === 'number')) {
        (0, logger_1.logStart)(event, heat, time);
    }
    const payload = {
        ...msg,
        timestamp: Date.now(),
    };
    broadcastAllClients(wss, payload);
}
function handleLap(msg, wss) {
    const { lane, timestamp } = msg;
    if ((typeof lane === 'string' || typeof lane === 'number')
        && typeof timestamp === 'number') {
        (0, logger_1.logLap)(lane, timestamp);
    }
    const payload = {
        ...msg,
        timestamp: Date.now(),
    };
    broadcastAllClients(wss, payload);
}
function handleReset(msg, wss) {
    (0, logger_1.logStop)(Date.now());
    const payload = {
        ...msg,
        timestamp: Date.now(),
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
                case 'start':
                    handleStart(msgObj, wss);
                    return;
                case 'split':
                    handleLap(msgObj, wss);
                    return;
                case 'reset':
                    handleReset(msgObj, wss);
                    return;
                default:
                    break;
            }
            // Default: broadcast other messages as-is
            broadcastAllClients(wss, msgObj);
        });
        ws.on('close', () => {
            clientLiveness.delete(ws);
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
    setInterval(() => {
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ type: 'time_sync', server_time: Date.now() }));
            }
        });
    }, 5000);
    wss.on('close', () => {
        clearInterval(heartbeat);
        clientLiveness.clear();
    });
}
