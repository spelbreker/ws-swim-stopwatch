import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Message } from './messageTypes';
import {
  logLap,
  logStart,
  logStop,
} from './logger';

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
  const payload = {
    ...msg,
    timestamp: Date.now(),
  };
  broadcastAllClients(wss, payload);
}

function handleLap(msg: Record<string, unknown>, wss: WebSocketServer) {
  const { lane, timestamp } = msg;
  if (
    (typeof lane === 'string' || typeof lane === 'number')
    && typeof timestamp === 'number'
  ) {
    logLap(lane, timestamp);
  }
  const payload = {
    ...msg,
    timestamp: Date.now(),
  };
  broadcastAllClients(wss, payload);
}

function handleReset(msg: Record<string, unknown>, wss: WebSocketServer) {
  logStop(Date.now());
  const payload = {
    ...msg,
    timestamp: Date.now(),
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
      } else {
        clientLiveness.set(client, false);
        client.ping();
      }
    });
  }, 30000);

  // Periodically broadcast time_sync to all clients
  setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'time_sync', server_time: Date.now() }));
      }
    });
  }, 5000);

  wss.on('close', () => {
    clearInterval(heartbeat);
    clientLiveness.clear();
  });
}
