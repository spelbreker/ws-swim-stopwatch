"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const routes_1 = require("./routes/routes");
const websocket_1 = require("./websockets/websocket");
const tunnel_1 = require("./modules/tunnel");
const tunnelRestriction_1 = require("./middleware/tunnelRestriction");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const upload = (0, multer_1.default)({ dest: 'uploads/' });
// Apply tunnel restriction middleware BEFORE serving static files
app.use(tunnelRestriction_1.tunnelRestrictionMiddleware);
app.use(express_1.default.static('public'));
// Register all API routes
(0, routes_1.registerRoutes)(app, upload);
// Setup WebSocket server
(0, websocket_1.setupWebSocket)(server);
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
    // Initialize tunnel if auto-start is enabled
    (0, tunnel_1.initTunnel)();
});
