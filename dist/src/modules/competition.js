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
    constructor() {
        this.competitionData = null;
        this.loadCompetitionData();
    }
    loadCompetitionData() {
        if (!fs_1.default.existsSync(Competition.COMPETITION_FILE_PATH)) {
            this.competitionData = null;
            return;
        }
        try {
            const fileContent = fs_1.default.readFileSync(Competition.COMPETITION_FILE_PATH, 'utf-8');
            this.competitionData = JSON.parse(fileContent);
        }
        catch (err) {
            console.error('[Competition] Failed to parse competition.json:', err);
            this.competitionData = null;
        }
    }
    // readAndProcessCompetitionJSON
    static readAndProcessCompetitionJSON(filePath, callback) {
        fs_1.default.readFile(filePath, async (err, data) => {
            if (err) {
                callback(err, null);
                return;
            }
            // Dynamic import for ESM compatibility
            const { parseLenex } = await Promise.resolve().then(() => __importStar(require('js-lenex/build/src/lenex-parse.js')));
            const result = await parseLenex(data);
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
     * Helper to validate competitionData, meetIndex, and sessionIndex.
     */
    assertValidIndices(meetIndex, sessionIndex) {
        if (!this.competitionData)
            throw new Error('Missing competition.json');
        if (!this.competitionData.meets[meetIndex])
            throw new Error('Invalid meetIndex');
        if (!this.competitionData.meets[meetIndex].sessions[sessionIndex])
            throw new Error('Invalid sessionIndex');
    }
    /**
     * Returns meet summary for given indices.
     */
    getMeetSummary(meetIndex, sessionIndex) {
        this.assertValidIndices(meetIndex, sessionIndex);
        return {
            meet: this.competitionData.meets[meetIndex].name,
            first_session_date: this.competitionData.meets[meetIndex].sessions[sessionIndex].date,
            session_count: this.competitionData.meets[meetIndex].sessions.length,
            event_count: this.competitionData.meets[meetIndex].sessions
                .map((session) => session.events.length)
                .reduce((a, b) => a + b, 0),
            club_count: this.competitionData.meets[meetIndex].clubs.length,
        };
    }
    /**
     * Returns all events for a given meet/session.
     */
    getEvents(meetIndex, sessionIndex) {
        this.assertValidIndices(meetIndex, sessionIndex);
        return this.competitionData.meets[meetIndex].sessions[sessionIndex].events;
    }
    /**
     * Returns a single event by event number.
     */
    getEvent(meetIndex, sessionIndex, eventNumber) {
        this.assertValidIndices(meetIndex, sessionIndex);
        return this.competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber) || null;
    }
    /**
     * Returns heat data or relay entries for a given event/heat.
     */
    getHeat(meetIndex, sessionIndex, eventNumber, heatNumber) {
        this.assertValidIndices(meetIndex, sessionIndex);
        const event = this.competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);
        if (!event)
            return null;
        const heat = event.heats.find((heat) => heat.number === heatNumber);
        if (!heat)
            return null;
        if (event.swimstyle.relaycount > 1) {
            return this.extractRelay(event.eventid, heat.heatid);
        }
        const entries = this.getAthletesByHeatId(heat.heatid);
        if (entries.length === 0)
            return null;
        return entries;
    }
    getAthletesByHeatId(heatId) {
        if (!this.competitionData)
            return [];
        const entries = this.competitionData.meets[0].clubs
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
    }
    findAthleteById(athleteId) {
        if (!this.competitionData)
            return null;
        for (const club of this.competitionData.meets[0].clubs) {
            if (club.athletes) {
                for (const athlete of club.athletes) {
                    if (athlete.athleteid === athleteId) {
                        return athlete;
                    }
                }
            }
        }
        return null;
    }
    extractRelay(event, heat) {
        if (!this.competitionData)
            return [];
        const relayEntries = this.competitionData.meets[0].clubs
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
                    const athlete = this.findAthleteById(position.athleteid);
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
    }
    findAthletesWithoutEntries() {
        if (!this.competitionData)
            return [];
        const result = [];
        for (const club of this.competitionData.meets[0].clubs) {
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
    reload() {
        this.loadCompetitionData();
    }
}
Competition.COMPETITION_FILE_PATH = './public/competition.json';
exports.default = Competition;
// Usage: import Competition from './competition';
// const comp = new Competition();
// comp.getMeetSummary(...)
