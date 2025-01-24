const fs = require('fs');
const multer = require('multer');
const { parseLenex } = require('js-lenex/build/src/lenex-parse.js');
const upload = multer({ dest: 'uploads/' });

const readAndProcessCompetitionJSON = (filePath, callback) => {
    fs.readFile(filePath, async (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }

        let result = await parseLenex(data);

        if (!result.meets?.length) {
            callback('No meets found', null);
            return;
        }

        if (!result.meets[0]?.sessions?.length) {
            callback('No sessions found', null);
            return;
        }

        if (!result.meets[0]?.sessions[0]?.events?.length) {
            callback('No events found', null);
            return;
        }
        //check heats
        if (!result.meets[0]?.sessions[0]?.events[0]?.heats?.length) {
            callback('No heats found', null);
            return;
        }

        if (!result.meets[0]?.clubs?.length) {
            callback('No clubs found', null);
            return;
        }

        //write the competition.json file
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

        fs.writeFileSync('./public/events.json', JSON.stringify(eventsMap));

        let athletesMap = result.meets[0].clubs.map((club) => {
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

        fs.writeFileSync('./public/athletes.json', JSON.stringify(athletesMap));

        callback(null, result);
    });
};

const handleFileUpload = (req, res) => {
    const filePath = req.file.path;
    readAndProcessCompetitionJSON(filePath, (err, result) => {
        if (err) {
            res.status(500).send('Error reading file - ' + err);
            return;
        }
        //delete uploaded file
        fs.unlinkSync(filePath);
        //redircet to the upload.html page
        res.redirect('/upload.html');
    });
};

const getCompetitionSummary = (req, res) => {

    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let summary = {
        meet: competitionData.meets[0].name,
        first_session_date: competitionData.meets[0].sessions[0].date,
        session_count: competitionData.meets[0].sessions.length,
        event_count: competitionData.meets[0].sessions.map((session) => session.events.length).reduce((a, b) => a + b, 0),
        club_count: competitionData.meets[0].clubs.length,
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(summary));
};

const getCompetitionEvents = (req, res) => {
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

    events = events.sort((a, b) => {
        return a.number - b.number;
    });

    events.forEach((event) => {
        event.heats = event.heats.sort((a, b) => {
            return a.number - b.number;
        });
    });

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
};

const getCompetition = (req, res) => {
    let eventNumber = parseInt(req.query.event);
    let heatNumber = parseInt(req.query.heat);
    let sessionIndex = 0;
    if (req.query.session) {
        sessionIndex = parseInt(req.query.session);
    }

    if (!eventNumber || !heatNumber) {
        res.status(400).send('Missing eventNumber or heatNumber');
        return;
    }

    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let event = competitionData.meets[0].sessions[sessionIndex].events.find((event) => event.number === eventNumber);

    if (!event) {
        res.status(404).send('Event not found');
        return;
    }

    let heat = event.heats.find((heat) => heat.number === heatNumber);

    if (!event || !heat) {
        res.status(404).send('Event or heat not found');
        return;
    }

    let competition = {
        event: {
            number: event.number,
            order: event.order,
            eventid: event.event,
            swimstyle: event.swimstyle,
        },
        heat: heat,
        entries: findAthletes(competitionData, event.eventid, heat.heatid),
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(competition));
};

const findAthletes = (competitionData, event, heat) => {
    let entries = competitionData.meets[0].clubs
        .map((club) => {
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

    entries = entries.sort((a, b) => {
        return a[0].lane - b[0].lane;
    });

    return entries;
};

const deleteCompetition = (req, res) => {
    fs.unlinkSync('./public/competition.json');
    fs.unlinkSync('./public/events.json');
    fs.unlinkSync('./public/athletes.json');
    res.status(200).send('Competition deleted');
};

module.exports = {
    upload,
    handleFileUpload,
    getCompetitionEvents,
    getCompetition,
    findAthletes,
    getCompetitionSummary,
    deleteCompetition,
};
