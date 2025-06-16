"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.comp = void 0;
exports.getEvents = getEvents;
exports.getEvent = getEvent;
const competition_1 = __importDefault(require("../../../modules/competition"));
exports.comp = new competition_1.default();
function getEvents(req, res) {
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionIndex = req.query.session ? parseInt(req.query.session, 10) : 0;
    try {
        const events = exports.comp.getEvents(meetIndex, sessionIndex);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(events));
    }
    catch (e) {
        res.status(500).send('Error getting events');
    }
}
function getEvent(req, res) {
    const eventNumber = parseInt(req.params.event, 10);
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionIndex = req.query.session ? parseInt(req.query.session, 10) : 0;
    if (!eventNumber) {
        res.status(404).send('Missing eventNumber');
        return;
    }
    try {
        const event = exports.comp.getEvent(meetIndex, sessionIndex, eventNumber);
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
            meetIndex,
            sessionIndex,
            stack: e instanceof Error ? e.stack : undefined,
        });
        const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
        res.status(500).send(`Error getting event: ${errorMsg}`);
    }
}
