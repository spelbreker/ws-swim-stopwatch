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
class Competition {
    /**
     * Returns a summary of all meets and their sessions for selector UI.
     * Each meet includes its name, index, and a sessions array (with date/index/count).
     *
     * @returns {MeetSessionSummary[]} Array of meet/session summary objects.
     * @throws {Error} If the competition data file is missing or invalid.
     */
    /**
     * Returns a summary of all meets and their sessions for selector UI.
     * Uses meetNumber/sessionNumber (from data) instead of array index.
     */
    static getMeetsAndSessions() {
        const data = Competition.readCompetitionDataFromDisk();
        return data.meets.map((meet) => ({
            meetNumber: meet.number,
            name: meet.name,
            city: meet.city,
            nation: meet.nation?.toString?.() ?? undefined,
            sessions: meet.sessions.map((session) => ({
                sessionNumber: session.number,
                date: session.date,
                eventCount: Array.isArray(session.events) ? session.events.length : 0,
                daytime: session.daytime,
            })),
        }));
    }
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
    /**
     * Helper to map meetNumber/sessionNumber to array indices.
     * Throws if not found.
     */
    static getIndicesByNumber(data, meetNumber, sessionNumber) {
        const meetIdx = data.meets.findIndex(m => m.number === meetNumber);
        if (meetIdx === -1)
            throw new Error('Invalid meetNumber');
        const sessionIdx = data.meets[meetIdx].sessions.findIndex(s => s.number === sessionNumber);
        if (sessionIdx === -1)
            throw new Error('Invalid sessionNumber');
        return { meetIdx, sessionIdx };
    }
    /**
     * Returns meet summary for given indices.
     */
    /**
     * Returns meet summary for given meet/session numbers.
     */
    static getMeetSummary(meetNumber, sessionNumber) {
        const data = Competition.readCompetitionDataFromDisk();
        const { meetIdx, sessionIdx } = Competition.getIndicesByNumber(data, meetNumber, sessionNumber);
        const meet = data.meets[meetIdx];
        const session = meet.sessions[sessionIdx];
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
    /**
     * Returns all events for a given meet/session number.
     */
    static getEvents(meetNumber, sessionNumber) {
        const data = Competition.readCompetitionDataFromDisk();
        const { meetIdx, sessionIdx } = Competition.getIndicesByNumber(data, meetNumber, sessionNumber);
        return data.meets[meetIdx].sessions[sessionIdx].events;
    }
    /**
     * Returns a single event by event number.
     */
    /**
     * Returns a single event by event number, for a given meet/session number.
     */
    static getEvent(meetNumber, sessionNumber, eventNumber) {
        const data = Competition.readCompetitionDataFromDisk();
        const { meetIdx, sessionIdx } = Competition.getIndicesByNumber(data, meetNumber, sessionNumber);
        return data.meets[meetIdx].sessions[sessionIdx].events
            .find((event) => event.number === eventNumber) || null;
    }
    /**
     * Returns heat data or relay entries for a given event/heat.
     */
    /**
     * Returns heat data or relay entries for a given event/heat, by meet/session number.
     */
    static getHeat(meetNumber, sessionNumber, eventNumber, heatNumber) {
        const data = Competition.readCompetitionDataFromDisk();
        const { meetIdx, sessionIdx } = Competition.getIndicesByNumber(data, meetNumber, sessionNumber);
        const { events } = data.meets[meetIdx].sessions[sessionIdx];
        const event = events.find((ev) => ev.number === eventNumber);
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
        const defaultMeet = data.meets[0];
        if (!defaultMeet)
            return [];
        const entries = defaultMeet.clubs
            .flatMap((club) => {
            if (!Array.isArray(club.athletes))
                return [];
            return club.athletes.map((athlete) => {
                if (!Array.isArray(athlete.entries))
                    return null;
                const filterResult = athlete.entries.filter((entry) => entry.heatid === heatId);
                if (filterResult.length === 0)
                    return null;
                const [firstEntry] = filterResult;
                return {
                    lane: firstEntry.lane,
                    entrytime: firstEntry.entrytime,
                    club: club.name,
                    athletes: [{
                            athleteid: athlete.athleteid,
                            firstname: athlete.firstname,
                            lastname: athlete.lastname,
                            birthdate: athlete.birthdate,
                        }],
                };
            });
        })
            .filter((x) => x !== null)
            .sort((a, b) => a.lane - b.lane);
        return entries;
    }
    static findAthleteById(data, athleteId) {
        const defaultMeet = data.meets[0];
        if (!defaultMeet)
            return null;
        const found = defaultMeet.clubs
            .flatMap((club) => (Array.isArray(club.athletes) ? club.athletes : []))
            .find((athlete) => athlete.athleteid === athleteId);
        return found || null;
    }
    static extractRelay(data, event, heat) {
        const defaultMeet = data.meets[0];
        if (!defaultMeet)
            return [];
        const relayEntries = defaultMeet.clubs
            .flatMap((club) => {
            if (!Array.isArray(club.relays))
                return [];
            return club.relays.map((relay) => {
                const firstEntry = relay.entries[0];
                if (!firstEntry || firstEntry.heatid !== heat || firstEntry.eventid !== event)
                    return null;
                return {
                    lane: firstEntry.lane,
                    entrytime: firstEntry.entrytime,
                    club: club.name,
                    relayid: relay.relayid,
                    athletes: firstEntry.relaypositions.map((position) => {
                        const athlete = Competition.findAthleteById(data, position.athleteid);
                        return {
                            athleteid: position.athleteid,
                            firstname: athlete?.firstname ?? '',
                            lastname: athlete?.lastname ?? '',
                        };
                    }),
                };
            });
        })
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
            const { parseLenex } = await Promise.resolve().then(() => __importStar(require('js-lenex/build/src/lenex-parse')));
            const result = await parseLenex(data);
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
// comp.getMeetSummary(...
