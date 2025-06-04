"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCompetition = uploadCompetition;
exports.getCompetitionSummary = getCompetitionSummary;
exports.deleteCompetition = deleteCompetition;
const fs_1 = __importDefault(require("fs"));
const competition_1 = require("../../modules/competition");
function loadCompetitionData() {
    if (!fs_1.default.existsSync('./public/competition.json'))
        return null;
    return JSON.parse(fs_1.default.readFileSync('./public/competition.json', 'utf-8'));
}
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
            fs_1.default.unlinkSync(filePath);
        }
        catch { }
        res.redirect('/competition/upload.html');
    });
}
function getCompetitionSummary(req, res) {
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
function deleteCompetition(req, res) {
    try {
        (0, competition_1.deleteCompetition)();
        res.status(200).send('Competition deleted');
    }
    catch (e) {
        res.status(500).send('Error deleting competition');
    }
}
