"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvents = getEvents;
exports.getEvent = getEvent;
const competition_1 = __importDefault(require("../../../modules/competition"));
function getEvents(req, res) {
    const meetNumber = req.query.meet ? parseInt(req.query.meet, 10) : undefined;
    const sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
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
    const eventNumber = req.params.event ? parseInt(req.params.event, 10) : undefined;
    const meetNumber = req.query.meet ? parseInt(req.query.meet, 10) : undefined;
    const sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
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
