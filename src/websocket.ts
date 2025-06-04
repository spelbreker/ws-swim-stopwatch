import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

// Type-safe WebSocket message definition
type Message =
  | { type: 'ping'; time: number }
  | { type: 'pong'; time: number }
  | { type: string;[key: string]: unknown }; // Extend as needed

function isMessage(obj: unknown): obj is Message {
  return (
    typeof obj === 'object'
    && obj !== null
    && 'type' in obj
    // && typeof (obj as any).type === 'string' // Original comment, kept for consistency
  );
}

// Track client liveness in a Map
const clientLiveness = new Map<WebSocket, boolean>();

export function initializeWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    clientLiveness.set(ws, true);
    console.log('WebSocket connection established.'); // Added log

    ws.on('pong', () => {
      clientLiveness.set(ws, true);
    });

    ws.on('message', (message: string) => {
      let msg: unknown;
      try {
        msg = JSON.parse(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
        return;
      }
      if (!isMessage(msg)) {
        console.error('Received invalid WebSocket message structure:', msg);
        return;
      }

      if (msg.type === 'ping' && typeof msg.time === 'number') {
        ws.send(JSON.stringify({ type: 'pong', time: msg.time }));
      }
      // Broadcast message to all clients
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

    ws.on('error', (error: Error) => { // Added error handling for individual ws
      console.error('WebSocket error on client:', error);
      // Optionally, clean up clientLiveness here if the connection is deemed unusable
      // clientLiveness.delete(ws); // Or rely on 'close' event
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      if (!clientLiveness.get(client)) {
        client.terminate();
        clientLiveness.delete(client);
        console.log('Terminated inactive WebSocket client.'); // Added log
      } else {
        clientLiveness.set(client, false);
        client.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
    clientLiveness.clear();
    console.log('WebSocket server closed, heartbeat stopped.');
  });

  // Optional: Handle errors on the WebSocket server itself
  wss.on('error', (error: Error) => {
    console.error('WebSocket Server error:', error);
    // Potentially try to restart or clean up resources
    clearInterval(heartbeat); // Stop heartbeat on WSS error
    clientLiveness.clear();
  });

  console.log('WebSocket server initialized.');
}
