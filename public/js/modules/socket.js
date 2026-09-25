// Shared WebSocket connection with auto-reconnect.
// Replaces the window.socket global from main.js.
//
// Usage:
//   import { send, onSocketEvent, getSocket } from '../js/modules/socket.js';
//
// onSocketEvent(callback) — callback receives (event, socket, data):
//   event: 'open' | 'close' | 'message'
//   socket: the WebSocket instance
//   data: parsed JSON message (only for 'message' events)

let socket = null;
let reconnectTimer = null;
const listeners = new Set();

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.addEventListener('open', () => {
    clearTimeout(reconnectTimer);
    listeners.forEach((fn) => fn('open', socket));
  });

  socket.addEventListener('close', () => {
    listeners.forEach((fn) => fn('close', socket));
    reconnectTimer = setTimeout(connect, 1000);
  });

  socket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    listeners.forEach((fn) => fn('message', socket, data));
  });
}

export function getSocket() {
  if (!socket) connect();
  return socket;
}

export function send(msg) {
  const s = getSocket();
  if (s.readyState === WebSocket.OPEN) {
    s.send(JSON.stringify(msg));
  }
}

export function onSocketEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Connect on first import
connect();
