"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeetSummary = getMeetSummary;
exports.getEvents = getEvents;
exports.getEvent = getEvent;
exports.getHeat = getHeat;
exports.handleFileUpload = handleFileUpload;
exports.deleteCompetition = deleteCompetition;
const fs_1 = __importDefault(require("fs"));
const competition_1 = require("../modules/competition");
function loadCompetitionData() {
    if (!fs_1.default.existsSync('./public/competition.json'))
        return null;
    return JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
}
function getMeetSummary(req, res) {
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionIndex = req.query.session ? parseInt(req.query.session, 10) : 0;
    const data = loadCompetitionData();
    if (!data) {
        res.status(500).send('Missing competition.json');
        return;
    }
    try {
        const summary = (0, competition_1.getMeetSummary)(data, meetIndex, sessionIndex);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(summary));
    }
    catch (e) {
        res.status(500).send('Error generating summary');
    }
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
function getHeat(req, res) {
    const eventNumber = parseInt(req.params.event, 10);
    const heatNumber = parseInt(req.params.heat, 10);
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionIndex = req.query.session ? parseInt(req.query.session, 10) : 0;
    if (!eventNumber || !heatNumber) {
        res.status(400).send('Missing eventNumber or heatNumber');
        return;
    }
    const data = loadCompetitionData();
    if (!data) {
        res.status(500).send('Missing competition.json');
        return;
    }
    try {
        const result = (0, competition_1.getHeat)(data, meetIndex, sessionIndex, eventNumber, heatNumber);
        if (!result) {
            res.status(404).send('Heat or entries not found');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    }
    catch (e) {
        res.status(500).send('Error getting heat');
    }
}
function handleFileUpload(req, res) {
    const file = req.file;
    if (!file) {
        res.status(400).send('No file uploaded');
        return;
    }
    (0, competition_1.handleFileUploadPure)(file.path, (err) => {
        if (err) {
            res.status(500).send(`Error reading file - ${err}`);
            return;
        }
        res.redirect('/competition/upload.html');
    });
}
function deleteCompetition(req, res) {
    try {
        (0, competition_1.deleteCompetition)();
        res.status(200).send('Competition deleted');
    }
    catch (e) {
        res.status(500).send('Error deleting competition');
    }
}
