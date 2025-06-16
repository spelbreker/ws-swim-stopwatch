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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Minimal Lenex types for conversion
function convertLenexToCompetitionData(lenex) {
    const l = lenex;
    return {
        meets: Array.isArray(l.meets)
            ? l.meets.map((meet) => ({
                name: String(meet.name ?? ''),
                sessions: Array.isArray(meet.sessions)
                    ? meet.sessions.map((session) => ({
                        date: String(session.date ?? ''),
                        events: Array.isArray(session.events)
                            ? session.events.map((event) => ({
                                number: Number(event.number),
                                order: Number(event.order),
                                eventid: String(event.eventid ?? event.number ?? ''),
                                gender: String(event.gender ?? ''),
                                swimstyle: {
                                    relaycount: Number(event.swimstyle?.relaycount ?? 0),
                                    stroke: String(event.swimstyle?.stroke ?? ''),
                                    distance: Number(event.swimstyle?.distance ?? 0),
                                },
                                heats: Array.isArray(event.heats)
                                    ? event.heats.map((heat) => ({
                                        heatid: String(heat.heatid ?? ''),
                                        number: Number(heat.number),
                                        order: Number(heat.order),
                                        daytime: heat.daytime ? String(heat.daytime) : undefined,
                                    }))
                                    : [],
                            }))
                            : [],
                    }))
                    : [],
                clubs: Array.isArray(meet.clubs)
                    ? meet.clubs.map((club) => ({
                        name: String(club.name ?? ''),
                        athletes: Array.isArray(club.athletes)
                            ? club.athletes.map((athlete) => ({
                                athleteid: String(athlete.athleteid ?? ''),
                                firstname: String(athlete.firstname ?? ''),
                                lastname: String(athlete.lastname ?? ''),
                                birthdate: String(athlete.birthdate ?? ''),
                                entries: Array.isArray(athlete.entries)
                                    ? athlete.entries.map((entry) => ({
                                        eventid: String(entry.eventid ?? ''),
                                        heatid: String(entry.heatid ?? ''),
                                        entrytime: String(entry.entrytime ?? ''),
                                        lane: Number(entry.lane),
                                    }))
                                    : [],
                            }))
                            : [],
                        relays: Array.isArray(club.relays)
                            ? club.relays.map((relay) => ({
                                relayid: String(relay.relayid ?? ''),
                                entries: Array.isArray(relay.entries)
                                    ? relay.entries.map((relayEntry) => ({
                                        eventid: String(relayEntry.eventid ?? ''),
                                        heatid: String(relayEntry.heatid ?? ''),
                                        entrytime: String(relayEntry.entrytime ?? ''),
                                        lane: Number(relayEntry.lane),
                                        relaypositions: Array.isArray(relayEntry.relaypositions)
                                            ? relayEntry.relaypositions.map((pos) => ({
                                                athleteid: String(pos.athleteid ?? ''),
                                            }))
                                            : [],
                                    }))
                                    : [],
                            }))
                            : [],
                    }))
                    : [],
            }))
            : [],
    };
}
class Competition {
    static readCompetitionDataFromDisk() {
        if (!fs_1.default.existsSync(Competition.COMPETITION_FILE_PATH)) {
            throw new Error('Missing competition.json');
        }
        try {
            const fileContent = fs_1.default.readFileSync(Competition.COMPETITION_FILE_PATH, 'utf-8');
            return JSON.parse(fileContent);
        }
        catch (err) {
            console.error('[Competition] Failed to parse competition.json:', err);
            throw new Error('Invalid competition.json');
        }
    }
    /**
     * Helper to validate competitionData, meetIndex, and sessionIndex.
     */
    static assertValidIndices(data, meetIndex, sessionIndex) {
        if (!data.meets[meetIndex])
            throw new Error('Invalid meetIndex');
        if (!data.meets[meetIndex].sessions[sessionIndex])
            throw new Error('Invalid sessionIndex');
    }
    /**
     * Returns meet summary for given indices.
     */
    static getMeetSummary(meetIndex, sessionIndex) {
        const data = Competition.readCompetitionDataFromDisk();
        Competition.assertValidIndices(data, meetIndex, sessionIndex);
        const meet = data.meets[meetIndex];
        const session = meet.sessions[sessionIndex];
        return {
            meet: meet.name,
            first_session_date: session.date,
            session_count: meet.sessions.length,
            event_count: meet.sessions
                .map((s) => s.events.length)
                .reduce((a, b) => a + b, 0),
            club_count: meet.clubs.length,
        };
    }
    /**
     * Returns all events for a given meet/session.
     */
    static getEvents(meetIndex, sessionIndex) {
        const data = Competition.readCompetitionDataFromDisk();
        Competition.assertValidIndices(data, meetIndex, sessionIndex);
        return data.meets[meetIndex].sessions[sessionIndex].events;
    }
    /**
     * Returns a single event by event number.
     */
    static getEvent(meetIndex, sessionIndex, eventNumber) {
        const data = Competition.readCompetitionDataFromDisk();
        Competition.assertValidIndices(data, meetIndex, sessionIndex);
        return data.meets[meetIndex].sessions[sessionIndex].events
            .find((event) => event.number === eventNumber) || null;
    }
    /**
     * Returns heat data or relay entries for a given event/heat.
     */
    static getHeat(meetIndex, sessionIndex, eventNumber, heatNumber) {
        const data = Competition.readCompetitionDataFromDisk();
        Competition.assertValidIndices(data, meetIndex, sessionIndex);
        const event = data.meets[meetIndex].sessions[sessionIndex].events.find((ev) => ev.number === eventNumber);
        if (!event)
            return null;
        const heat = event.heats.find((ht) => ht.number === heatNumber);
        if (!heat)
            return null;
        if (event.swimstyle.relaycount > 1) {
            return Competition.extractRelay(data, event.eventid, heat.heatid);
        }
        const entries = Competition.getAthletesByHeatId(data, heat.heatid);
        if (entries.length === 0)
            return null;
        return entries;
    }
    static findAthletesWithoutEntries() {
        const data = Competition.readCompetitionDataFromDisk();
        if (!data.meets[0])
            return [];
        return data.meets[0].clubs
            .flatMap((club) => (Array.isArray(club.athletes) ? club.athletes : [])
            .filter((athlete) => !Array.isArray(athlete.entries) || athlete.entries.length === 0)
            .map((athlete) => ({
            club: club.name,
            athleteid: athlete.athleteid,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            birthdate: athlete.birthdate,
        })));
    }
    static getAthletesByHeatId(data, heatId) {
        if (!data.meets[0])
            return [];
        const entries = data.meets[0].clubs
            .map((club) => (Array.isArray(club.athletes) ? club.athletes : []).map((athlete) => {
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
        }))
            .flat()
            .filter((x) => x !== null)
            .sort((a, b) => a.lane - b.lane);
        return entries;
    }
    static findAthleteById(data, athleteId) {
        if (!data.meets[0])
            return null;
        const found = data.meets[0].clubs
            .flatMap((club) => (Array.isArray(club.athletes) ? club.athletes : []))
            .find((athlete) => athlete.athleteid === athleteId);
        return found || null;
    }
    static extractRelay(data, event, heat) {
        if (!data.meets[0])
            return [];
        const relayEntries = data.meets[0].clubs
            .flatMap((club) => (Array.isArray(club.relays) ? club.relays : []).map((relay) => {
            if (!relay.entries.length || relay.entries[0].heatid !== heat || relay.entries[0].eventid !== event) {
                return null;
            }
            return {
                lane: relay.entries[0].lane,
                entrytime: relay.entries[0].entrytime,
                club: club.name,
                relayid: relay.relayid,
                athletes: relay.entries[0].relaypositions.map((position) => {
                    const athlete = Competition.findAthleteById(data, position.athleteid);
                    return {
                        athleteid: position.athleteid,
                        firstname: athlete ? athlete.firstname : '',
                        lastname: athlete ? athlete.lastname : '',
                    };
                }),
            };
        }))
            .filter((x) => x !== null)
            .sort((a, b) => a.lane - b.lane);
        return relayEntries;
    }
    /**
     * readAndProcessCompetitionJSON
     */
    static readAndProcessCompetitionJSON(filePath, callback) {
        fs_1.default.readFile(filePath, async (err, data) => {
            if (err) {
                callback(err, null);
                return;
            }
            // Dynamic import for ESM compatibility
            // eslint-disable-next-line import/extensions
            const { parseLenex } = await Promise.resolve().then(() => __importStar(require('js-lenex/build/src/lenex-parse')));
            const lenexRaw = await parseLenex(data);
            const result = convertLenexToCompetitionData(lenexRaw);
            // Fallbacks for type safety
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
            // Use absolute path for reliability
            const absPath = path_1.default.resolve(process.cwd(), 'public', 'competition.json');
            console.log('[Competition] Writing competition.json to:', absPath);
            try {
                fs_1.default.writeFileSync(absPath, JSON.stringify(result));
            }
            catch (writeErr) {
                const error = writeErr instanceof Error ? writeErr : new Error(String(writeErr));
                console.error('[Competition] Failed to write competition.json:', error);
                callback(error, null);
                return;
            }
            callback(null, result);
        });
    }
}
Competition.COMPETITION_FILE_PATH = './public/competition.json';
exports.default = Competition;
// Usage: import Competition from './competition';
// const comp = new Competition();
// comp.getMeetSummary(...)
