import http from 'http';
import express from 'express';
import multer from 'multer';
import { registerRoutes } from './routes/routes';
import { setupWebSocket } from './websockets/websocket';
import { initTunnel } from './modules/tunnel';
import { tunnelRestrictionMiddleware } from './middleware/tunnelRestriction';

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: 'uploads/' });

// Apply tunnel restriction middleware BEFORE serving static files
app.use(tunnelRestrictionMiddleware);

app.use(express.static('public'));

// Register all API routes
registerRoutes(app, upload);

// Setup WebSocket server
setupWebSocket(server);

server.listen(8080, () => {
  console.log('Server is listening on port 8080');
  
  // Initialize tunnel if auto-start is enabled
  initTunnel();
});
