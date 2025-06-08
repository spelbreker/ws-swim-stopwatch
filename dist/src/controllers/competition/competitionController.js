"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCompetition = uploadCompetition;
exports.getCompetitionSummary = getCompetitionSummary;
exports.deleteCompetition = deleteCompetition;
const competition_1 = require("../../modules/competition");
const fs_1 = __importDefault(require("fs"));
function uploadCompetition(req, res) {
    const file = req.file;
    if (!file) {
        res.status(400).send('No file uploaded');
        return;
    }
    const filePath = file.path;
    (0, competition_1.readAndProcessCompetitionJSON)(filePath, (err) => {
        if (err) {
            res.status(500).send(`Error reading file - ${err}`);
            return;
        }
        try {
            require('fs').unlinkSync(filePath);
        }
        catch { }
        res.redirect('/competition/upload.html');
    });
}
function getCompetitionSummary(req, res) {
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionIndex = req.query.session ? parseInt(req.query.session, 10) : 0;
    try {
        const summary = (0, competition_1.getMeetSummary)(meetIndex, sessionIndex);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(summary));
    }
    catch (e) {
        res.status(500).send('Error generating summary');
    }
}
function deleteCompetition(req, res) {
    try {
        if (fs_1.default.existsSync('./public/competition.json'))
            fs_1.default.unlinkSync('./public/competition.json');
        if (fs_1.default.existsSync('./public/events.json'))
            fs_1.default.unlinkSync('./public/events.json');
        if (fs_1.default.existsSync('./public/athletes.json'))
            fs_1.default.unlinkSync('./public/athletes.json');
        res.status(200).send('Competition deleted');
    }
    catch (e) {
        res.status(500).send('Error deleting competition');
    }
}
