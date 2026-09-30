"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompetitionLog = getCompetitionLog;
exports.clearCompetitionLog = clearCompetitionLog;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function downloadFilename(now = new Date()) {
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `competition-${stamp}.log`;
}
function logFilePath() {
    return path_1.default.join(process.cwd(), 'logs', 'competition.log');
}
function getCompetitionLog(req, res) {
    const logPath = logFilePath();
    fs_1.default.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            res.status(404).send('Logbestand niet gevonden.');
            return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (req.query.download !== undefined) {
            res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename()}"`);
        }
        res.send(data);
    });
}
// Truncate rather than unlink: the logger appends per write, and the viewer then shows an empty log instead of a 404.
function clearCompetitionLog(_req, res) {
    fs_1.default.writeFile(logFilePath(), '', (err) => {
        if (err) {
            res.status(500).send('Logbestand kon niet worden gewist.');
            return;
        }
        res.status(204).end();
    });
}
