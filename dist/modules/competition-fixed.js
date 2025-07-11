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
     * Each meet includes its name, city, nation, and a sessions array (with date, session number, event count, and daytime).
     *
     * @returns {MeetSessionSummary[]} Array of meet/session summary objects for all meets.
     * @throws {Error} If the competition data file is missing or invalid.
     *
     * @example
     * const meets = Competition.getMeetsAndSessions();
     * // meets[0].sessions[0].date -> '2025-07-01'
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
    /**
     * Reads and parses the competition data file from disk.
     *
     * @returns {CompetitionData} The parsed competition data object.
     * @throws {Error} If the file is missing or cannot be parsed.
     */
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
     * Maps meetNumber and sessionNumber to their respective array indices in the competition data.
     *
     * @param data - The competition data object.
     * @param meetNumber - The meet number to look up.
     * @param sessionNumber - The session number to look up.
     * @returns The indices for the meet and session in the data arrays.
     * @throws {Error} If the meet or session number is invalid.
     */
    static getIndicesByNumber(data, meetNumber, sessionNumber) {
        const meetIdx = data.meets.findIndex((m) => m.number === meetNumber);
        if (meetIdx === -1)
            throw new Error('Invalid meetNumber');
        const sessionIdx = data.meets[meetIdx].sessions.findIndex((s) => s.number === sessionNumber);
        if (sessionIdx === -1)
            throw new Error('Invalid sessionNumber');
        return { meetIdx, sessionIdx };
    }
    /**
     * Returns a summary for a specific meet/session combination.
     *
     * @param meetNumber - The meet number to summarize.
     * @param sessionNumber - The session number to summarize.
     * @returns An object with meet name, first session date, session count, event count, and club count.
     * @throws {Error} If the meet or session number is invalid or data is missing.
     *
     * @example
     * const summary = Competition.getMeetSummary(1, 1);
     * // summary.meet -> 'Meet 1'
     */
    static getMeetSummary(meetNumber, sessionNumber) {
        // Default to first available meet/session if missing
        if (!meetNumber || !sessionNumber) {
            const first = Competition.getFirstMeetSession();
            if (!first) {
                throw new Error('No meet/session data available');
            }
            meetNumber = first.meetNumber;
            sessionNumber = first.sessionNumber;
        }
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
     * Returns all events for a given meet/session number.
     *
     * @param meetNumber - The meet number to look up.
     * @param sessionNumber - The session number to look up.
     * @returns An array of CompetitionEvent objects for the specified meet/session.
     * @throws {Error} If the meet or session number is invalid.
     *
     * @example
     * const events = Competition.getEvents(1, 1);
     * // events[0].number -> 1
     */
    static getEvents(meetNumber, sessionNumber) {
        // Default to first available meet/session if missing
        if (!meetNumber || !sessionNumber) {
            const first = Competition.getFirstMeetSession();
            if (!first) {
                throw new Error('No meet/session data available');
            }
            meetNumber = first.meetNumber;
            sessionNumber = first.sessionNumber;
        }
        const data = Competition.readCompetitionDataFromDisk();
        const { meetIdx, sessionIdx } = Competition.getIndicesByNumber(data, meetNumber, sessionNumber);
        return data.meets[meetIdx].sessions[sessionIdx].events;
    }
    /**
     * Returns a single event by event number, for a given meet/session number.
     *
     * @param meetNumber - The meet number to look up.
     * @param sessionNumber - The session number to look up.
     * @param eventNumber - The event number to look up.
     * @returns The CompetitionEvent object if found, otherwise null.
     * @throws {Error} If the meet or session number is invalid.
     *
     * @example
     * const event = Competition.getEvent(1, 1, 1);
     * // event?.number -> 1
     */
    static getEvent(meetNumber, sessionNumber, eventNumber) {
        // Default to first available meet/session/event if any parameter is missing
        if (!meetNumber || !sessionNumber || !eventNumber) {
            const first = Competition.getFirstMeetSessionEventHeat();
            if (!first)
                throw new Error('No meet/session/event data available');
            meetNumber = first.meetNumber;
            sessionNumber = first.sessionNumber;
            eventNumber = first.eventNumber;
        }
        const data = Competition.readCompetitionDataFromDisk();
        const { meetIdx, sessionIdx } = Competition.getIndicesByNumber(data, meetNumber, sessionNumber);
        return data.meets[meetIdx].sessions[sessionIdx].events
            .find((ev) => ev.number === eventNumber) || null;
    }
    /**
     * Returns heat data or relay entries for a given event/heat, by meet/session number.
     *
     * @param meetNumber - The meet number to look up.
     * @param sessionNumber - The session number to look up.
     * @param eventNumber - The event number to look up.
     * @param heatNumber - The heat number to look up.
     * @returns An array of AthleteResult or RelayResult for the specified heat, or null if not found.
     * @throws {Error} If the meet, session, or event number is invalid.
     *
     * @example
     * const entries = Competition.getHeat(1, 1, 1, 1);
     * // entries[0].lane -> 1
     */
    static getHeat(meetNumber, sessionNumber, eventNumber, heatNumber) {
        // Default to first available meet/session/event/heat if any parameter is missing or invalid
        if (!meetNumber || !sessionNumber || !eventNumber || !heatNumber) {
            const first = Competition.getFirstMeetSessionEventHeat();
            if (!first) {
                throw new Error('No meet/session/event/heat data available');
            }
            meetNumber = first.meetNumber;
            sessionNumber = first.sessionNumber;
            eventNumber = first.eventNumber;
            heatNumber = first.heatNumber;
        }
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
    /**
     * Returns a list of athletes without any entries for the first meet.
     *
     * @returns An array of objects with club and athlete info for athletes without entries.
     * @example
     * const athletes = Competition.findAthletesWithoutEntries();
     * // athletes[0].club -> 'Club Name'
     */
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
    /**
     * Returns all athlete entries for a given heat ID, sorted by lane.
     *
     * @param data - The competition data object.
     * @param heatId - The heat ID to look up.
     * @returns An array of AthleteResult objects for the specified heat.
     * @example
     * const entries = Competition.getAthletesByHeatId(data, 'heat-1');
     * // entries[0].lane -> 1
     */
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
    /**
     * Finds an athlete by athleteId in the first meet.
     *
     * @param data - The competition data object.
     * @param athleteId - The athlete ID to look up.
     * @returns The CompetitionAthlete object if found, otherwise null.
     * @example
     * const athlete = Competition.findAthleteById(data, 123);
     * // athlete?.firstname -> 'John'
     */
    static findAthleteById(data, athleteId) {
        const defaultMeet = data.meets[0];
        if (!defaultMeet)
            return null;
        const found = defaultMeet.clubs
            .flatMap((club) => (Array.isArray(club.athletes) ? club.athletes : []))
            .find((athlete) => athlete.athleteid === athleteId);
        return found || null;
    }
    /**
     * Returns relay entries for a given event and heat.
     *
     * @param data - The competition data object.
     * @param event - The event ID to look up.
     * @param heat - The heat ID to look up.
     * @returns An array of RelayResult objects for the specified relay heat.
     * @example
     * const relays = Competition.extractRelay(data, 'event-1', 'heat-1');
     * // relays[0].relayid -> 'relay-1'
     */
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
     * Reads a Lenex competition file, parses it, validates the structure, and writes it to competition.json.
     *
     * @param filePath - The path to the uploaded Lenex file.
     * @param callback - Callback function called with (err, result) after processing.
     *   - err: Error or string if something went wrong, otherwise null.
     *   - result: Parsed LenexRaw object if successful, otherwise null.
     *
     * @example
     * Competition.readAndProcessCompetitionJSON('/tmp/upload.lxf', (err, result) => {
     *   if (err) throw err;
     *   // result.meets[0].name
     * });
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
    /**
     * Helper to get the first available meet and session number from competition data.
     * @returns {{ meetNumber: number, sessionNumber: number } | undefined}
     */
    static getFirstMeetSession() {
        try {
            const data = Competition.getMeetsAndSessions();
            if (data.length > 0 && data[0].sessions.length > 0) {
                return {
                    meetNumber: data[0].meetNumber,
                    sessionNumber: data[0].sessions[0].sessionNumber,
                };
            }
        }
        catch {
            // ignore errors and return undefined
        }
        return undefined;
    }
    /**
     * Helper to get the first available meet/session/event/heat from competition data.
     * @returns {{ meetNumber: number, sessionNumber: number, eventNumber: number, heatNumber: number } | undefined}
     */
    static getFirstMeetSessionEventHeat() {
        try {
            const meets = Competition.getMeetsAndSessions();
            if (!meets.length || !meets[0].sessions.length)
                return undefined;
            const meetNumber = meets[0].meetNumber;
            const sessionNumber = meets[0].sessions[0].sessionNumber;
            // Get events for this meet/session
            const events = Competition.getEvents(meetNumber, sessionNumber);
            if (!events.length || !events[0].heats?.length)
                return undefined;
            const eventNumber = events[0].number;
            const heatNumber = events[0].heats[0].number;
            return { meetNumber, sessionNumber, eventNumber, heatNumber };
        }
        catch {
            return undefined;
        }
    }
}
/**
 * Path to the competition data file (JSON).
 */
Competition.COMPETITION_FILE_PATH = './public/competition.json';
exports.default = Competition;
