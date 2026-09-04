import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Message, DeviceInfo, DeviceInfoResponse } from './messageTypes';
import {
  logSplit,
  logIgnoredSplit,
  logStart,
  logReset,
} from './logger';
import { loadSettings } from '../modules/settings';
import { SplitTracker, computeHeatInfo } from '../modules/splitTracker';

// Store device information
const devices = new Map<string, DeviceInfo>();

// Per-heat split state (cooldown, distance labels, ranking)
let splitTracker = new SplitTracker(loadSettings);

export function getSplitTracker(): SplitTracker {
  return splitTracker;
}

export function resetSplitTracker() {
  splitTracker = new SplitTracker(loadSettings);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function applyHeatFromMessage(msg: Record<string, unknown>) {
  const event = toNumber(msg.event);
  const heat = toNumber(msg.heat);
  if (event === undefined || heat === undefined) return;
  splitTracker.setHeat(computeHeatInfo(event, heat, toNumber(msg.session), loadSettings().poolLength));
}

function isMessage(obj: unknown): obj is Message {
  return (
    typeof obj === 'object'
    && obj !== null
    && 'type' in obj
  );
}

function broadcastAllClients(wss: WebSocketServer, payload: unknown) {
  const withTimestamp = {
    ...(typeof payload === 'object' && payload !== null ? payload : {}),
    server_timestamp: Date.now(),
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(withTimestamp));
    }
  });
}

function handleStart(msg: Record<string, unknown>, wss: WebSocketServer) {
  const { event, heat, timestamp } = msg;
  if (
    (typeof timestamp === 'number')
    && (typeof event === 'string' || typeof event === 'number')
    && (typeof heat === 'string' || typeof heat === 'number')
  ) {
    logStart(event, heat, timestamp);
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

function handleSplit(msg: Record<string, unknown>, wss: WebSocketServer) {
  const lane = toNumber(msg.lane);
  const { timestamp, elapsed_ms } = msg;
  if (lane === undefined || typeof timestamp !== 'number') {
    // Malformed split: keep legacy behaviour and just relay it
    broadcastAllClients(wss, msg);
    return;
  }
  const result = splitTracker.onSplit(lane, timestamp);
  if (!result.accepted) {
    logIgnoredSplit(lane, timestamp, result.reason, result.msSinceLast);
    return;
  }
  const { distance, splitNumber, isFinish, ranking } = result;
  logSplit(lane, timestamp, typeof elapsed_ms === 'number' ? elapsed_ms : undefined, distance, splitNumber);
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

function handleEventHeat(msg: Record<string, unknown>, wss: WebSocketServer) {
  console.log(`[WebSocket] Event/Heat changed: event=${msg.event}, heat=${msg.heat}`);
  applyHeatFromMessage(msg);
  broadcastAllClients(wss, msg);
}

function handleReset(msg: Record<string, unknown>, wss: WebSocketServer) {
  const timestamp = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now();
  logReset(timestamp);
  splitTracker.onReset();
  // Preserve the original client timestamp - don't overwrite with server time
  const payload = {
    ...msg,
    timestamp,
  };
  broadcastAllClients(wss, payload);
}

function handlePing(msg: Record<string, unknown>, ws: WebSocket) {
  if (typeof msg.time === 'number') {
    ws.send(
      JSON.stringify({
        type: 'pong',
        client_ping_time: msg.time,
        server_time: Date.now(),
      }),
    );
  }
}

function handleDeviceRegister(msg: Record<string, unknown>, ws: WebSocket, wss: WebSocketServer) {
  const { ip, mac, role, lane } = msg;
  if (
    typeof ip === 'string'
    && typeof mac === 'string'
    && (role === 'starter' || role === 'lane')
  ) {
    const deviceInfo: DeviceInfo = {
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

function handleDeviceUpdateRole(msg: Record<string, unknown>) {
  const { mac, role } = msg;
  if (
    typeof mac === 'string'
    && (role === 'starter' || role === 'lane')
  ) {
    const device = devices.get(mac);
    if (device) {
      device.role = role;
      device.lastSeen = Date.now();
      console.log(`[WebSocket] Device role updated: ${mac} -> ${role}`);
    }
  }
}

function handleDeviceUpdateLane(msg: Record<string, unknown>) {
  const { mac, lane } = msg;
  if (
    typeof mac === 'string'
    && typeof lane === 'number'
  ) {
    const device = devices.get(mac);
    if (device) {
      device.lane = lane;
      device.lastSeen = Date.now();
      console.log(`[WebSocket] Device lane updated: ${mac} -> ${lane}`);
    }
  }
}

export function getDevices(): DeviceInfoResponse[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return Array.from(devices.values()).map(({ ws, ...device }) => device);
}

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });
  const clientLiveness = new Map<WebSocket, boolean>();

  wss.on('connection', (ws: WebSocket) => {
    clientLiveness.set(ws, true);

    ws.on('pong', () => {
      clientLiveness.set(ws, true);
    });

    ws.on('message', (message: string) => {
      let msg: unknown;
      try {
        msg = JSON.parse(message);
      } catch {
        return;
      }
      if (!isMessage(msg)) return;
      const msgObj: Record<string, unknown> = msg;
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
      } else {
        clientLiveness.set(client, false);
        client.ping();
      }
    });
  }, 30000);

  // Periodically broadcast time_sync to all clients
  const timeSync = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
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
