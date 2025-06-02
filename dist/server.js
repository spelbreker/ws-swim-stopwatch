"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const ws_1 = __importStar(require("ws"));
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const competition_1 = require("./modules/competition");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const upload = (0, multer_1.default)({ dest: 'uploads/' });
app.use(express_1.default.static('public'));
app.get('/competition/summary', competition_1.getMeetSummary);
app.post('/competition/upload', upload.single('lenexFile'), competition_1.handleFileUpload);
app.get('/competition/delete', competition_1.deleteCompetition);
app.get('/competition/event/:event', competition_1.getEvent);
app.get('/competition/event', competition_1.getEvents);
app.get('/competition/event/:event/heat/:heat', competition_1.getHeat);
app.get('*', (req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './public/index.html';
    }
    fs_1.default.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send(JSON.stringify(err));
            return;
        }
        res.writeHead(200);
        res.end(data);
    });
});
const wss = new ws_1.WebSocketServer({ server });
wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    ws.on('message', (message) => {
        let msg;
        try {
            msg = JSON.parse(message);
        }
        catch (e) {
            return;
        }
        if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', time: msg.time }));
        }
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify(msg));
            }
        });
    });
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);
wss.on('close', () => {
    clearInterval(interval);
});
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});
