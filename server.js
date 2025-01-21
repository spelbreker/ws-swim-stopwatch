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
    fs.readFile(filePath, async (err, data) => {
        if (err) {
            res.status(500).send('Error reading file');
            return;
        }

        let result = await parseLenex(data);
        //write result to file
        fs.writeFileSync('./public/competition.json', JSON.stringify(result));

        let events = result.meets[0].sessions[0].events;

        let eventsMap = events.map((event) => {
            return {
                number: event.number,
                order: event.order,
                eventid: event.eventid,
                gender: event.gender,
                swimstyle: event.swimstyle,
                heats: event.heats.map((heat) => {
                    return {
                        heatid: heat.heatid,
                        number: heat.number,
                        order: heat.order,
                        daytime: heat?.daytime,
                    };
                }),
            };
        });

        //write for debugging
        fs.writeFileSync('./public/events.json', JSON.stringify(eventsMap));

        let athleatesMap = result.meets[0].clubs.map((club) => {
            return club.athletes.map((athlete) => {
                return {
                    athleteid: athlete.athleteid,
                    firstname: athlete.firstname,
                    lastname: athlete.lastname,
                    birthdate: athlete.birthdate,
                    club: club.name,
                    entries: athlete.entries.map((entry) => {
                        return {
                            eventid: entry.eventid,
                            heatid: entry.heatid,
                            entrytime: entry.entrytime,
                            lane: entry.lane,
                        };
                    }),
                };
            });
        });
        //write for debugging
        fs.writeFileSync('./public/athleats.json', JSON.stringify(athleatesMap));

        //add json header to response
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    });
});

app.get('/competition/events', (req, res) => {
    //check if json exist
    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let events = competitionData.meets[0].sessions[0].events.map((event) => {
        return {
            number: event.number,
            order: event.order,
            eventid: event.event,
            heats: event.heats.map((heat) => {
                return {
                    heatid: heat.heatid,
                    number: heat.number,
                    order: heat.order,
                    daytime: heat?.daytime,
                };
            })
        };
    });

    //order by event number
    events = events.sort((a, b) => {
        return a.number - b.number;
    });

    //order by heat number
    events.forEach((event) => {
        event.heats = event.heats.sort((a, b) => {
            return a.number - b.number;
        });
    });

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
});

app.get('/competition', (req, res) => {
    //get get param event number and heat number cast to int
    let eventNumber = parseInt(req.query.event);
    let heatNumber = parseInt(req.query.heat);

    //if no event number or heat number return error
    if (!eventNumber || !heatNumber) {
        res.status(400).send('Missing eventNumber or heatNumber');
        return;
    }

    //check if json exist
    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    //give eventdata with heat entry data
    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let event = competitionData.meets[0].sessions[0].events.find((event) => event.number === eventNumber);
    let heat = event.heats.find((heat) => heat.number === heatNumber);

    let competition = {
        event: {
            number: event.number,
            order: event.order,
            eventid: event.event,
            swimstyle: event.swimstyle,
        },
        heat: heat,
        entries: findAtlheates(competitionData,event.eventid, heat.heatid),
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(competition));

});

function findAtlheates(competitionData, event, heat) {
    console.log('Using eventId:', event, 'and heatId:', heat);

    let entries = competitionData.meets[0].clubs
        .map((club) => {
            console.log('Checking club:', club.name);
            return club.athletes
                .map((athlete) => {
                    let filterResult = athlete.entries.filter((entry) => {
                        return entry.heatid === heat && entry.eventid === event;
                    });
                    
                    if (filterResult.length === 0) {
                        return null;
                    }
                    
                    return {
                        athleteid: athlete.athleteid,
                        firstname: athlete.firstname,
                        lastname: athlete.lastname,
                        club: club.name,
                        lane: filterResult[0]?.lane,
                        entrytime: filterResult[0]?.entrytime,
                    };
                })
                .filter(Boolean);
        })
        .filter((clubEntries) => clubEntries.length > 0);

    //order by lane nr
    entries = entries.sort((a, b) => {
        return a[0].lane - b[0].lane;
    });

    console.log('entries:', entries);
    return entries;
}

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
