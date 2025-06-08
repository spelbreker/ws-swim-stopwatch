import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Message } from './messageTypes';

function isMessage(obj: unknown): obj is Message {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj
  );
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

      if (msg.type === 'ping' && typeof msg.time === 'number') {
        ws.send(JSON.stringify({ type: 'pong', client_ping_time: msg.time, server_time: Date.now() }));
        return;
      }
      // Handle start/stop/reset to always include server timestamp
      if (msg.type === 'start' || msg.type === 'reset' || msg.type === 'stop') {
        const payload = { ...msg, timestamp: Date.now() };
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(payload));
          }
        });
        return;
      }
      // Default: broadcast other messages as-is
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(msg));
        }
      });
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
