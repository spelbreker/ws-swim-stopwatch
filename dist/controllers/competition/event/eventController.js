"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvents = getEvents;
exports.getEvent = getEvent;
/**
 * Helper to get the first available meet and session number from competition data.
 * @returns {{ meetNumber: number, sessionNumber: number } | undefined}
 */
function getFirstMeetSession() {
    try {
        const data = competition_1.default.getMeetsAndSessions();
        if (data.length > 0 && data[0].sessions.length > 0) {
            return {
                meetNumber: data[0].meetNumber,
                sessionNumber: data[0].sessions[0].sessionNumber,
            };
        }
    }
    catch {
        // ignore
    }
    return undefined;
}
const competition_1 = __importDefault(require("../../../modules/competition"));
function getEvents(req, res) {
    let meetNumber = req.query.meet ? parseInt(req.query.meet, 10) : undefined;
    let sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
    if (!meetNumber || !sessionNumber) {
        const first = getFirstMeetSession();
        if (!first) {
            res.status(400).send('No meet/session data available');
            return;
        }
        meetNumber = first.meetNumber;
        sessionNumber = first.sessionNumber;
    }
    try {
        const events = competition_1.default.getEvents(meetNumber, sessionNumber);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(events));
    }
    catch {
        res.status(500).send('Error getting events');
    }
}
function getEvent(req, res) {
    const eventNumber = parseInt(req.params.event, 10);
    let meetNumber = req.query.meet ? parseInt(req.query.meet, 10) : undefined;
    let sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
    if (!meetNumber || !sessionNumber) {
        const first = getFirstMeetSession();
        if (!first) {
            res.status(404).send('No meet/session data available');
            return;
        }
        meetNumber = first.meetNumber;
        sessionNumber = first.sessionNumber;
    }
    if (!eventNumber) {
        res.status(404).send('Missing eventNumber');
        return;
    }
    try {
        const event = competition_1.default.getEvent(meetNumber, sessionNumber, eventNumber);
        if (!event) {
            res.status(404).send('Event not found');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(event));
    }
    catch (e) {
        // Enhanced error logging for debugging
        console.error('[getEvent] Error getting event:', {
            error: e,
            eventNumber,
            meetNumber,
            sessionNumber,
            stack: e instanceof Error ? e.stack : undefined,
        });
        const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
        res.status(500).send(`Error getting event: ${errorMsg}`);
    }
}
