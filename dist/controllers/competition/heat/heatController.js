"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeat = getHeat;
const competition_1 = __importDefault(require("../../../modules/competition"));
function getHeat(req, res) {
    const eventNumber = parseInt(req.params.event, 10);
    const heatNumber = parseInt(req.params.heat, 10);
    const meetIndex = req.query.meet ? parseInt(req.query.meet, 10) : 0;
    const sessionNumber = req.query.session ? parseInt(req.query.session, 10) : undefined;
    if (!eventNumber || !heatNumber) {
        res.status(400).send('Missing eventNumber or heatNumber');
        return;
    }
    try {
        const result = competition_1.default.getHeat(meetIndex, sessionNumber, eventNumber, heatNumber);
        if (!result) {
            res.status(404).send('Heat or entries not found');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }
    catch (_e) {
        res.status(500).send('Error getting heat');
    }
}
