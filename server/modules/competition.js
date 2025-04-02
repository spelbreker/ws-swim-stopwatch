const fs = require('fs');
const { parseLenex } = require('js-lenex/build/src/lenex-parse.js');

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

        // let events = result.meets[0].sessions[0].events;

        // let eventsMap = events.map((event) => {
        //     return {
        //         number: event.number,
        //         order: event.order,
        //         eventid: event.eventid,
        //         gender: event.gender,
        //         swimstyle: event.swimstyle,
        //         heats: event.heats.map((heat) => {
        //             return {
        //                 heatid: heat.heatid,
        //                 number: heat.number,
        //                 order: heat.order,
        //                 daytime: heat?.daytime,
        //             };
        //         }),
        //     };
        // });

        // fs.writeFileSync('./public/events.json', JSON.stringify(eventsMap));

        // let athletesMap = result.meets[0].clubs.map((club) => {
        //     return (club.athletes || []).map((athlete) => {
        //         return {
        //             athleteid: athlete.athleteid,
        //             firstname: athlete.firstname,
        //             lastname: athlete.lastname,
        //             birthdate: athlete.birthdate,
        //             club: club.name,
        //             entries: athlete.entries.map((entry) => {
        //                 return {
        //                     eventid: entry.eventid,
        //                     heatid: entry.heatid,
        //                     entrytime: entry.entrytime,
        //                     lane: entry.lane,
        //                 };
        //             }),
        //         };
        //     });
        // });

        // fs.writeFileSync('./public/athletes.json', JSON.stringify(athletesMap));

        callback(null, result);
    });
};

/** 
 * 
 * callable url function  
 * 
 * */

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
        res.redirect('/competition/upload.html');
    });
};

const getMeetSummary = (req, res) => {
    let meetIndex = 0;
    let sessionIndex = 0;
    if (req.query.session) {
        sessionIndex = parseInt(req.query.session);
    }
    if (req.query.meet) {
        meetIndex = parseInt(req.query.meet);
    }

    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let summary = {
        meet: competitionData.meets[meetIndex].name,
        first_session_date: competitionData.meets[meetIndex].sessions[sessionIndex].date,
        session_count: competitionData.meets[meetIndex].sessions.length,
        event_count: competitionData.meets[meetIndex].sessions.map((session) => session.events.length).reduce((a, b) => a + b, 0),
        club_count: competitionData.meets[meetIndex].clubs.length,
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(summary));
};

// events list
const getEvents = (req, res) => {
    let meetIndex = 0;
    let sessionIndex = 0;
    //query params for session and meet
    if (req.query.session) {
        sessionIndex = parseInt(req.query.session);
    }
    if (req.query.meet) {
        meetIndex = parseInt(req.query.meet);
    }

    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let events = competitionData.meets[meetIndex].sessions[sessionIndex].events;

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
};

//get single event
const getEvent = (req, res) => {
    let eventNumber = parseInt(req.params.event);
    let meetIndex = 0;
    let sessionIndex = 0;
    //query params for session and meet
    if (req.query.session) {
        sessionIndex = parseInt(req.query.session);
    }
    if (req.query.meet) {
        meetIndex = parseInt(req.query.meet);
    }

    if (!eventNumber) {
        res.status(400).send('Missing eventNumber');
        return;
    }

    if (!fs.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }

    let competitionData = fs.readFileSync('./public/competition.json');
    competitionData = JSON.parse(competitionData);

    let event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);

    if (!event) {
        res.status(404).send('Event not found');
        return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(event));
};

const getHeat = (req, res) => {
    let eventNumber = parseInt(req.params.event);
    let heatNumber = parseInt(req.params.heat);
    let meetIndex = 0;
    let sessionIndex = 0;
    //query params for session and meet
    if (req.query.session) {
        sessionIndex = parseInt(req.query.session);
    }
    if (req.query.meet) {
        meetIndex = parseInt(req.query.meet);
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

    let event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);

    if (!event) {
        res.status(404).send('Event not found');
        return;
    }

    let heat = event.heats.find((heat) => heat.number === heatNumber);

    if (!heat) {
        res.status(404).send('Heat not found');
        return;
    }

    //check if event is a relay
    if (event.swimstyle.relaycount > 1) {
        let relayEntries = extractRelay(competitionData, event.eventid, heat.heatid);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(relayEntries));
        return;
    }

    let entries = getAthletesByHeatId(competitionData, heat.heatid);

    
    if (entries.length === 0) {
        res.status(404).send('No entries found for the specified heat');
        return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(entries));
}

const deleteCompetition = (req, res) => {
    fs.unlinkSync('./public/competition.json');
    fs.unlinkSync('./public/events.json');
    fs.unlinkSync('./public/athletes.json');
    res.status(200).send('Competition deleted');
};

/** 
 * 
 * helper functions 
 * 
 */

const getAthletesByHeatId = (competitionData, heatId) => {
    let entries = competitionData.meets[0].clubs
        .map((club) => {
            return (club.athletes || []).map((athlete) => {
                let filterResult = athlete.entries.filter((entry) => {
                    return entry.heatid === heatId;
                });
                
                if (filterResult.length === 0) {
                    return null;
                }

                return {
                    lane: filterResult[0]?.lane,
                    entrytime: filterResult[0]?.entrytime,
                    club: club.name,
                    athletes: [{
                        athleteid: athlete.athleteid,
                        firstname: athlete.firstname,
                        lastname: athlete.lastname,
                        birthdate: athlete.birthdate,
                    }],
                    
                };
            })
            .filter(Boolean);
        })
        .filter((clubEntries) => clubEntries.length > 0);

    entries = entries.flat();
    entries = entries.sort((a, b) => {
        return a.lane - b.lane;
    });

    return entries;
};

const findAthleteById = (competitionData, athleteId) => {
    for (const club of competitionData.meets[0].clubs) {
        if (club.athletes) {
            for (const athlete of club.athletes) {
                if (athlete.athleteid === athleteId) {
                    return athlete;
                }
            }
        }
    }
    return null;
};

const extractRelay = (competitionData, event, heat) => {
    let relayEntries = competitionData.meets[0].clubs
        .map((club) => {
            return (club.relays || []).map((relay) => {
                if (!relay.entries.length || relay.entries[0].heatid !== heat || relay.entries[0].eventid !== event) {
                    return null;
                }

                return {
                    lane: relay.entries[0].lane,
                    entrytime: relay.entries[0].entrytime,
                    club: club.name,
                    relayid: relay.relayid,
                    athletes: relay.entries[0].relaypositions.map((position) => {
                        let athlete = findAthleteById(competitionData, position.athleteid);
                        return {
                            athleteid: position.athleteid,
                            firstname: athlete ? athlete.firstname : '',
                            lastname: athlete ? athlete.lastname : '',
                        };
                    }),
                    
                };
            })
            .filter(Boolean);
        })
        .filter((clubRelays) => clubRelays.length > 0);

    relayEntries = relayEntries.flat();
    relayEntries = relayEntries.sort((a, b) => {
        return a.lane - b.lane;
    });

    return relayEntries;
};

module.exports = {
    handleFileUpload,
    getMeetSummary,
    getEvents,
    deleteCompetition,
    findAthleteById,  
    getHeat,
    getEvent,
};
