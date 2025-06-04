"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const competitionController_1 = require("../controllers/competitionController");
// Register all competition-related routes
function registerRoutes(app, upload) {
    app.get('/competition/summary', competitionController_1.getMeetSummary);
    app.post('/competition/upload', upload.single('lenexFile'), competitionController_1.handleFileUpload);
    app.get('/competition/delete', competitionController_1.deleteCompetition);
    app.get('/competition/event/:event', competitionController_1.getEvent);
    app.get('/competition/event', competitionController_1.getEvents);
    app.get('/competition/event/:event/heat/:heat', competitionController_1.getHeat);
}
