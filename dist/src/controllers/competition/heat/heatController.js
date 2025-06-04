"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeat = getHeat;
const fs_1 = __importDefault(require("fs"));
const competition_1 = require("../../../modules/competition");
function loadCompetitionData() {
    if (!fs_1.default.existsSync('./public/competition.json'))
        return null;
    return JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
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
