"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRelay = exports.findAthleteById = exports.getAthletesByHeatId = exports.readAndProcessCompetitionJSON = void 0;
exports.getMeetSummary = getMeetSummary;
exports.getEvents = getEvents;
exports.getEvent = getEvent;
exports.getHeat = getHeat;
exports.deleteCompetition = deleteCompetition;
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
        const result = await (0, lenex_parse_js_1.parseLenex)(data);
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
/**
 * Returns meet summary for given indices.
 */
function getMeetSummary(competitionData, meetIndex, sessionIndex) {
    if (!competitionData.meets[meetIndex])
        throw new Error('Invalid meetIndex');
    if (!competitionData.meets[meetIndex].sessions[sessionIndex])
        throw new Error('Invalid sessionIndex');
    return {
        meet: competitionData.meets[meetIndex].name,
        first_session_date: competitionData.meets[meetIndex].sessions[sessionIndex].date,
        session_count: competitionData.meets[meetIndex].sessions.length,
        event_count: competitionData.meets[meetIndex].sessions
            .map((session) => session.events.length)
            .reduce((a, b) => a + b, 0),
        club_count: competitionData.meets[meetIndex].clubs.length,
    };
}
/**
 * Returns all events for a given meet/session.
 */
function getEvents(competitionData, meetIndex, sessionIndex) {
    if (!competitionData.meets[meetIndex])
        throw new Error('Invalid meetIndex');
    if (!competitionData.meets[meetIndex].sessions[sessionIndex])
        throw new Error('Invalid sessionIndex');
    return competitionData.meets[meetIndex].sessions[sessionIndex].events;
}
/**
 * Returns a single event by event number.
 */
function getEvent(competitionData, meetIndex, sessionIndex, eventNumber) {
    if (!competitionData.meets[meetIndex])
        throw new Error('Invalid meetIndex');
    if (!competitionData.meets[meetIndex].sessions[sessionIndex])
        throw new Error('Invalid sessionIndex');
    return competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber) || null;
}
/**
 * Returns heat data or relay entries for a given event/heat.
 */
function getHeat(competitionData, meetIndex, sessionIndex, eventNumber, heatNumber) {
    if (!competitionData.meets[meetIndex])
        throw new Error('Invalid meetIndex');
    if (!competitionData.meets[meetIndex].sessions[sessionIndex])
        throw new Error('Invalid sessionIndex');
    const event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);
    if (!event)
        return null;
    const heat = event.heats.find((heat) => heat.number === heatNumber);
    if (!heat)
        return null;
    if (event.swimstyle.relaycount > 1) {
        return (0, exports.extractRelay)(competitionData, event.eventid, heat.heatid);
    }
    const entries = (0, exports.getAthletesByHeatId)(competitionData, heat.heatid);
    if (entries.length === 0)
        return null;
    return entries;
}
/**
 * Deletes competition files.
 */
function deleteCompetition() {
    if (fs_1.default.existsSync('./public/competition.json'))
        fs_1.default.unlinkSync('./public/competition.json');
    if (fs_1.default.existsSync('./public/events.json'))
        fs_1.default.unlinkSync('./public/events.json');
    if (fs_1.default.existsSync('./public/athletes.json'))
        fs_1.default.unlinkSync('./public/athletes.json');
}
// getAthletesByHeatId
const getAthletesByHeatId = (competitionData, heatId) => {
    const entries = competitionData.meets[0].clubs
        .map((club) => (club.athletes || []).map((athlete) => {
        if (!Array.isArray(athlete.entries)) {
            return null;
        }
        const filterResult = athlete.entries.filter((entry) => entry.heatid === heatId);
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
    }));
    const flatEntries = entries
        .flat()
        .filter((x) => x !== null)
        .sort((a, b) => a.lane - b.lane);
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
    const relayEntries = competitionData.meets[0].clubs
        .map((club) => (club.relays || []).map((relay) => {
        if (!relay.entries.length || relay.entries[0].heatid !== heat || relay.entries[0].eventid !== event) {
            return null;
        }
        return {
            lane: relay.entries[0].lane,
            entrytime: relay.entries[0].entrytime,
            club: club.name,
            relayid: relay.relayid,
            athletes: relay.entries[0].relaypositions.map((position) => {
                const athlete = (0, exports.findAthleteById)(competitionData, position.athleteid);
                return {
                    athleteid: position.athleteid,
                    firstname: athlete ? athlete.firstname : '',
                    lastname: athlete ? athlete.lastname : '',
                };
            }),
        };
    }));
    const flatRelayEntries = relayEntries
        .flat()
        .filter((x) => x !== null)
        .sort((a, b) => a.lane - b.lane);
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
                        birthdate: athlete.birthdate,
                    });
                }
            }
        }
    }
    return result;
}
