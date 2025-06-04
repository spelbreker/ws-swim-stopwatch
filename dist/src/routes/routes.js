"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
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
}
