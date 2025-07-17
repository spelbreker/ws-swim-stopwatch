"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessions = getSessions;
const competition_1 = __importDefault(require("../../modules/competition"));
function getSessions(req, res) {
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    try {
        const sessions = competition_1.default.getSessions(meetIndex);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(sessions));
    }
    catch (e) {
        console.error('[getSessions] Error getting sessions:', e);
        const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
        res.status(500).send(`Error getting sessions: ${errorMsg}`);
    }
}
