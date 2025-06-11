"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const competitionController_1 = require("../controllers/competition/competitionController");
const eventController_1 = require("../controllers/competition/event/eventController");
const heatController_1 = require("../controllers/competition/heat/heatController");
// Register all competition-related routes
function registerRoutes(app, upload) {
    app.post('/competition/upload', upload.single('lenexFile'), competitionController_1.uploadCompetition);
    app.get('/competition/summary', competitionController_1.getCompetitionSummary);
    app.get('/competition/event', eventController_1.getEvents);
    app.get('/competition/event/:event', eventController_1.getEvent);
    app.get('/competition/event/:event/heat/:heat', heatController_1.getHeat);
    app.get('/competition/delete', competitionController_1.deleteCompetition);
    // Serve the log file securely for the log viewer
    app.get('/logs/competition.log', (req, res) => {
        const logPath = path_1.default.join(process.cwd(), 'logs', 'competition.log');
        fs_1.default.readFile(logPath, 'utf8', (err, data) => {
            if (err) {
                res.status(404).send('Logbestand niet gevonden.');
                return;
            }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(data);
        });
    });
}
