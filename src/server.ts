import http from 'http';
import fs from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import express, { Request, Response } from 'express';
import multer from 'multer';
import {
  handleFileUpload,
  getMeetSummary,
  deleteCompetition,
  getHeat,
  getEvents,
  getEvent,
} from './modules/competition';

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.get('/competition/summary', getMeetSummary);
app.post('/competition/upload', upload.single('lenexFile'), handleFileUpload);
app.get('/competition/delete', deleteCompetition);
app.get('/competition/event/:event', getEvent);
app.get('/competition/event', getEvents);
app.get('/competition/event/:event/heat/:heat', getHeat);

app.get('*', (req: Request, res: Response) => {
  let filePath = `.${req.url}`;
  if (filePath === './') filePath = './public/index.html';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.status(500).send(`Error: ${err.message}`);
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
// Track client liveness in a Map
const clientLiveness = new Map<WebSocket, boolean>();

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
    // && typeof (obj as any).type === 'string'
  );
}

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
      ws.send(JSON.stringify({ type: 'pong', time: msg.time }));
    }
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

wss.on('close', () => {
  clearInterval(heartbeat);
  clientLiveness.clear();
});

server.listen(8080, () => {
  console.log('Server is listening on port 8080');
});
