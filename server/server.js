const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const express = require('express');
const app = express();
const server = http.createServer(app);
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

const { handleFileUpload, getMeetSummary, deleteCompetition, getHeat, getEvents, getEvent } = require('./modules/competition');

app.get('/competition', getMeetSummary);
app.post('/competition/upload', upload.single('lenexFile'), handleFileUpload);

app.get('/competition/delete', deleteCompetition);

app.get('/competition/event/:event', getEvent);
app.get('/competition/event', getEvents);

app.get('/competition/event/:event/heat/:heat', getHeat);


app.get('*', (req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './public/index.html';
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send(JSON.stringify(err));
            return;
        }
        res.writeHead(200);
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            return;
        }
        if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', time: msg.time }));
        }
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
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
