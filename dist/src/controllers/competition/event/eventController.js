"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvents = getEvents;
exports.getEvent = getEvent;
const fs_1 = __importDefault(require("fs"));
const competition_1 = require("../../../modules/competition");
function loadCompetitionData() {
    if (!fs_1.default.existsSync('./public/competition.json'))
        return null;
    return JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
}
function getEvents(req, res) {
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionIndex = req.query.session ? parseInt(req.query.session, 10) : 0;
    const data = loadCompetitionData();
    if (!data) {
        res.status(500).send('Missing competition.json');
        return;
    }
    try {
        const events = (0, competition_1.getEvents)(data, meetIndex, sessionIndex);
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
        res.status(400).send('Missing eventNumber');
        return;
    }
    const data = loadCompetitionData();
    if (!data) {
        res.status(500).send('Missing competition.json');
        return;
    }
    try {
        const event = (0, competition_1.getEvent)(data, meetIndex, sessionIndex, eventNumber);
        if (!event) {
            res.status(404).send('Event not found');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(event));
    }
    catch (e) {
        res.status(500).send('Error getting event');
    }
}
