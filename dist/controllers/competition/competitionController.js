"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCompetition = uploadCompetition;
exports.getCompetitionSummary = getCompetitionSummary;
exports.deleteCompetition = deleteCompetition;
exports.getMeetsAndSessions = getMeetsAndSessions;
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
    const meetNumber = req.query.meet ? parseInt(req.query.meet, 10) : undefined;
    const sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
    try {
        const summary = competition_1.default.getMeetSummary(meetNumber, sessionNumber);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(summary));
    }
    catch {
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
/**
 * Controller to return all meets and their sessions for selector UI.
 *
 * Route: GET /competition/meets
 * Returns: Array of meets, each with sessions (see Competition.getMeetsAndSessions)
 *
 * Example response:
 * [
 *   {
 *     meetNumber: 1,
 *     name: 'Meet 1',
 *     city: 'Amsterdam',
 *     nation: 'NED',
 *     sessions: [
 *       { sessionNumber: 1, date: '2025-07-01', eventCount: 12 },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */
function getMeetsAndSessions(req, res) {
    try {
        const meets = competition_1.default.getMeetsAndSessions();
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(meets);
    }
    catch (err) {
        // Log error for dev/ops, but return user-friendly message
        console.error('[getMeetsAndSessions] Failed:', err);
        res.status(500).json({ error: 'Could not load meets/sessions. Please try again later.' });
    }
}
