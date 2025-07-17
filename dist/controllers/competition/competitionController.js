"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCompetition = uploadCompetition;
exports.getCompetitionSummary = getCompetitionSummary;
exports.deleteCompetition = deleteCompetition;
const fs_1 = __importDefault(require("fs"));
const competition_1 = __importDefault(require("../../modules/competition"));
function uploadCompetition(req, res) {
    // Use object destructuring for file
    const { file } = req;
    if (!file) {
        res.status(400).send('No file uploaded');
        return;
    }
    const filePath = file.path;
    competition_1.default.readAndProcessCompetitionJSON(filePath, (err) => {
        if (err) {
            res.status(500).send(`Error reading file - ${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (unlinkErr) {
            // Log error for dev/ops, but do not block user
            console.error('Failed to delete uploaded file:', unlinkErr);
        }
        res.redirect('/competition/upload.html');
    });
}
function getCompetitionSummary(req, res) {
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
    try {
        const summary = competition_1.default.getMeetSummary(meetIndex, sessionNumber);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(summary));
    } // eslint-disable-next-line @typescript-eslint/no-unused-vars
    catch (_e) {
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
    } // eslint-disable-next-line @typescript-eslint/no-unused-vars
    catch (_e) {
        res.status(500).send('Error deleting competition');
    }
}
