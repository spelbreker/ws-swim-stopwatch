"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeat = getHeat;
const competition_1 = __importDefault(require("../../../modules/competition"));
/**
 * Helper to get the first available meet/session/event/heat from competition data.
 * @returns {{ meetNumber: number, sessionNumber: number, eventNumber: number, heatNumber: number } | undefined}
 */
function getFirstMeetSessionEventHeat() {
    try {
        const meets = competition_1.default.getMeetsAndSessions();
        if (!meets.length || !meets[0].sessions.length)
            return undefined;
        const meetNumber = meets[0].meetNumber;
        const sessionNumber = meets[0].sessions[0].sessionNumber;
        // Get events for this meet/session
        const events = competition_1.default.getEvents(meetNumber, sessionNumber);
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
/**
 * Controller to return heat data for a given event/heat/meet/session, or defaults to the first available if missing.
 *
 * Route: GET /competition/heat/:event/:heat?meet=...&session=...
 *
 * If any parameter is missing, defaults to the first available meet/session/event/heat.
 */
function getHeat(req, res) {
    let eventNumber = req.params.event ? parseInt(req.params.event, 10) : undefined;
    let heatNumber = req.params.heat ? parseInt(req.params.heat, 10) : undefined;
    let meetNumber = req.query.meet ? parseInt(req.query.meet, 10) : undefined;
    let sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
    if (!eventNumber || !heatNumber || !meetNumber || !sessionNumber) {
        const first = getFirstMeetSessionEventHeat();
        if (!first) {
            res.status(400).send('No meet/session/event/heat data available');
            return;
        }
        meetNumber = first.meetNumber;
        sessionNumber = first.sessionNumber;
        eventNumber = first.eventNumber;
        heatNumber = first.heatNumber;
    }
    try {
        const result = competition_1.default.getHeat(meetNumber, sessionNumber, eventNumber, heatNumber);
        if (!result) {
            res.status(404).send('Heat or entries not found');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    }
    catch (e) {
        // Enhanced error logging for debugging
        console.error('[getHeat] Error getting heat:', {
            error: e,
            eventNumber,
            heatNumber,
            meetNumber,
            sessionNumber,
            stack: e instanceof Error ? e.stack : undefined,
        });
        const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
        res.status(500).send(`Error getting heat: ${errorMsg}`);
    }
}
