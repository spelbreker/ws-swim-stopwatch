import http from 'http';
import fs from 'fs';
// Removed WebSocket and WebSocketServer imports from 'ws'
import express, { Request, Response } from 'express';
import routes from './routes'; // Import the new router
import { initializeWebSocket } from './websocket'; // Import WebSocket initializer

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

app.use(routes); // Use the imported router

// Fallback for serving files - consider if this is fully covered by express.static or needs adjustment
app.get('*', (req: Request, res: Response) => {
  let filePath = `.${req.url}`;
  if (filePath === './') filePath = './public/index.html'; // Default to index.html for root
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Consider sending a 404 status for file not found
      res.status(err.code === 'ENOENT' ? 404 : 500).send(`Error: ${err.message}`);
      return;
    }
    // Determine content type or let browser infer
    res.writeHead(200);
    res.end(data);
  });
});

// Initialize WebSocket server
initializeWebSocket(server);

server.listen(8080, () => {
  console.log('Server is listening on port 8080');
});
