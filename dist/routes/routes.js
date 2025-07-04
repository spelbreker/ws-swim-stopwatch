"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const competitionController_1 = require("../controllers/competition/competitionController");
const eventController_1 = require("../controllers/competition/event/eventController");
const heatController_1 = require("../controllers/competition/heat/heatController");
const logController_1 = require("../controllers/competition/logController");
// Register all competition-related routes
function registerRoutes(app, upload) {
    app.post('/competition/upload', upload.single('lenexFile'), competitionController_1.uploadCompetition);
    app.get('/competition/summary', competitionController_1.getCompetitionSummary);
    app.get('/competition/event', eventController_1.getEvents);
    app.get('/competition/event/:event', eventController_1.getEvent);
    app.get('/competition/event/:event/heat/:heat', heatController_1.getHeat);
    app.get('/competition/delete', competitionController_1.deleteCompetition);
    // New: Meets and sessions selector endpoint
    // Returns all meets and their sessions for the selector UI
    // GET /competition/meets
    app.get('/competition/meets', competitionController_1.getMeetsAndSessions);
    // Serve the log file securely for the log viewer
    app.get('/logs/competition.log', logController_1.getCompetitionLog);
}
