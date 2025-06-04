"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const routes_1 = require("./routes/routes");
const websocket_1 = require("./websockets/websocket");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const upload = (0, multer_1.default)({ dest: 'uploads/' });
app.use(express_1.default.static('public'));
// Register all API routes
(0, routes_1.registerRoutes)(app, upload);
// Catch-all route for static files
app.get('*', (req, res) => {
    let filePath = `.${req.url}`;
    if (filePath === './')
        filePath = './public/index.html';
    fs_1.default.readFile(filePath, (err, data) => {
        if (err) {
            res.status(500).send(`Error: ${err.message}`);
            return;
        }
        res.writeHead(200);
        res.end(data);
    });
});
// Setup WebSocket server
(0, websocket_1.setupWebSocket)(server);
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});
