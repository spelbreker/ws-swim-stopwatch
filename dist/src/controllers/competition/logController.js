"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompetitionLog = getCompetitionLog;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function getCompetitionLog(req, res) {
    const logPath = path_1.default.join(process.cwd(), 'logs', 'competition.log');
    fs_1.default.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            res.status(404).send('Logbestand niet gevonden.');
            return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(data);
    });
}
