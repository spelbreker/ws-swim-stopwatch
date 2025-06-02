"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRelay = exports.findAthleteById = exports.getAthletesByHeatId = exports.deleteCompetition = exports.getHeat = exports.getEvent = exports.getEvents = exports.getMeetSummary = exports.handleFileUpload = exports.readAndProcessCompetitionJSON = void 0;
exports.findAthletesWithoutEntries = findAthletesWithoutEntries;
const fs_1 = __importDefault(require("fs"));
const lenex_parse_js_1 = require("js-lenex/build/src/lenex-parse.js");
// TypeScript conversion of all functions and exports
// readAndProcessCompetitionJSON
const readAndProcessCompetitionJSON = (filePath, callback) => {
    fs_1.default.readFile(filePath, async (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }
        let result = await (0, lenex_parse_js_1.parseLenex)(data);
        // Fallbacks for type safety
        if (!result.meets)
            result.meets = [];
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
        if (!result.meets[0]?.sessions[0]?.events[0]?.heats?.length) {
            callback('No heats found', null);
            return;
        }
        if (!result.meets[0]?.clubs?.length) {
            callback('No clubs found', null);
            return;
        }
        fs_1.default.writeFileSync('./public/competition.json', JSON.stringify(result));
        // Cast via unknown, want types zijn functioneel gelijk
        callback(null, result);
    });
};
exports.readAndProcessCompetitionJSON = readAndProcessCompetitionJSON;
// handleFileUpload
const handleFileUpload = (req, res) => {
    if (!req.file) {
        res.status(400).send('No file uploaded');
        return;
    }
    const filePath = req.file.path;
    (0, exports.readAndProcessCompetitionJSON)(filePath, (err, result) => {
        if (err) {
            res.status(500).send('Error reading file - ' + err);
            return;
        }
        fs_1.default.unlinkSync(filePath);
        res.redirect('/competition/upload.html');
    });
};
exports.handleFileUpload = handleFileUpload;
// getMeetSummary
const getMeetSummary = (req, res) => {
    let meetIndex = 0;
    let sessionIndex = 0;
    if (req.query.session)
        sessionIndex = parseInt(req.query.session);
    if (req.query.meet)
        meetIndex = parseInt(req.query.meet);
    if (!fs_1.default.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }
    let competitionData = JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
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
exports.getMeetSummary = getMeetSummary;
// getEvents
const getEvents = (req, res) => {
    let meetIndex = 0;
    let sessionIndex = 0;
    if (req.query.session)
        sessionIndex = parseInt(req.query.session);
    if (req.query.meet)
        meetIndex = parseInt(req.query.meet);
    if (!fs_1.default.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }
    let competitionData = JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
    let events = competitionData.meets[meetIndex].sessions[sessionIndex].events;
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
};
exports.getEvents = getEvents;
// getEvent
const getEvent = (req, res) => {
    let eventNumber = parseInt(req.params.event);
    let meetIndex = 0;
    let sessionIndex = 0;
    if (req.query.session)
        sessionIndex = parseInt(req.query.session);
    if (req.query.meet)
        meetIndex = parseInt(req.query.meet);
    if (!eventNumber) {
        res.status(400).send('Missing eventNumber');
        return;
    }
    if (!fs_1.default.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }
    let competitionData = JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
    let event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);
    if (!event) {
        res.status(404).send('Event not found');
        return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(event));
};
exports.getEvent = getEvent;
// getHeat
const getHeat = (req, res) => {
    let eventNumber = parseInt(req.params.event);
    let heatNumber = parseInt(req.params.heat);
    let meetIndex = 0;
    let sessionIndex = 0;
    if (req.query.session)
        sessionIndex = parseInt(req.query.session);
    if (req.query.meet)
        meetIndex = parseInt(req.query.meet);
    if (!eventNumber || !heatNumber) {
        res.status(400).send('Missing eventNumber or heatNumber');
        return;
    }
    if (!fs_1.default.existsSync('./public/competition.json')) {
        res.status(500).send('Missing competition.json');
        return;
    }
    let competitionData = JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
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
    if (event.swimstyle.relaycount > 1) {
        let relayEntries = (0, exports.extractRelay)(competitionData, event.eventid, heat.heatid);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(relayEntries));
        return;
    }
    let entries = (0, exports.getAthletesByHeatId)(competitionData, heat.heatid);
    if (entries.length === 0) {
        res.status(404).send('No entries found for the specified heat');
        return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(entries));
};
exports.getHeat = getHeat;
// deleteCompetition
const deleteCompetition = (req, res) => {
    fs_1.default.unlinkSync('./public/competition.json');
    fs_1.default.unlinkSync('./public/events.json');
    fs_1.default.unlinkSync('./public/athletes.json');
    res.status(200).send('Competition deleted');
};
exports.deleteCompetition = deleteCompetition;
// getAthletesByHeatId
const getAthletesByHeatId = (competitionData, heatId) => {
    let entries = competitionData.meets[0].clubs
        .map((club) => {
        return (club.athletes || []).map((athlete) => {
            if (!Array.isArray(athlete.entries)) {
                return null;
            }
            let filterResult = athlete.entries.filter((entry) => entry.heatid === heatId);
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
        });
    });
    const flatEntries = entries.flat().filter((x) => x !== null).sort((a, b) => a.lane - b.lane);
    return flatEntries;
};
exports.getAthletesByHeatId = getAthletesByHeatId;
// findAthleteById
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
exports.findAthleteById = findAthleteById;
// extractRelay
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
                    let athlete = (0, exports.findAthleteById)(competitionData, position.athleteid);
                    return {
                        athleteid: position.athleteid,
                        firstname: athlete ? athlete.firstname : '',
                        lastname: athlete ? athlete.lastname : '',
                    };
                }),
            };
        });
    });
    const flatRelayEntries = relayEntries.flat().filter((x) => x !== null).sort((a, b) => a.lane - b.lane);
    return flatRelayEntries;
};
exports.extractRelay = extractRelay;
// findAthletesWithoutEntries
function findAthletesWithoutEntries(competitionData) {
    const result = [];
    for (const club of competitionData.meets[0].clubs) {
        if (Array.isArray(club.athletes)) {
            for (const athlete of club.athletes) {
                if (!Array.isArray(athlete.entries) || athlete.entries.length === 0) {
                    result.push({
                        club: club.name,
                        athleteid: athlete.athleteid,
                        firstname: athlete.firstname,
                        lastname: athlete.lastname,
                        birthdate: athlete.birthdate
                    });
                }
            }
        }
    }
    return result;
}
