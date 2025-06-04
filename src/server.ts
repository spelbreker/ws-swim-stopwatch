import http from 'http';
import fs from 'fs';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { registerRoutes } from './routes/routes';
import { setupWebSocket } from './websockets/websocket';

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

// Register all API routes
registerRoutes(app, upload);

// Catch-all route for static files
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

// Setup WebSocket server
setupWebSocket(server);

server.listen(8080, () => {
  console.log('Server is listening on port 8080');
});
