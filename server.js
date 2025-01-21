const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const express = require('express');
const multer = require('multer');
const app = express();
const server = http.createServer(app);
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

const { parseLenex } = require('js-lenex/build/src/lenex-parse.js');


app.post('/upload', upload.single('lenexFile'), (req, res) => {
    const filePath = req.file.path;

    // readFile("./examples/example-entries.lxf").then((data) => {
    //     Lenex.LoadLenexFile(f).then((len) => {
    //         //save to json file
    //         fs.writeFileSync('./public/competition.json', JSON.stringify(len.rawLenexData, null, 2));
    //     });
    // });

    fs.readFile(filePath, async (err, data) => {
        if (err) {
            res.status(500).send('Error reading file');
            return;
        }

        let result = await parseLenex(data);
        console.log('results',this.raw);
        
        //write result to file
        fs.writeFileSync('./public/competition.json', JSON.stringify(result));

        //add json header to response
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    });
});

app.get('*', (req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
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
        const data = JSON.parse(message);
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
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
