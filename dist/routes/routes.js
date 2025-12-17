"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = require("express");
const competitionController_1 = require("../controllers/competition/competitionController");
const eventController_1 = require("../controllers/competition/event/eventController");
const heatController_1 = require("../controllers/competition/heat/heatController");
const sessionController_1 = require("../controllers/competition/sessionController");
const logController_1 = require("../controllers/competition/logController");
const devicesController_1 = require("../controllers/devicesController");
const tunnelController_1 = require("../controllers/tunnelController");
// Register all competition-related routes
function registerRoutes(app, upload) {
    // JSON body parser for tunnel routes - must be registered BEFORE routes
    app.use('/tunnel', (0, express_1.json)());
    // Tunnel management routes (defined after middleware)
    app.get('/tunnel/status', tunnelController_1.getTunnelStatus);
    app.post('/tunnel/start', tunnelController_1.postTunnelStart);
    app.post('/tunnel/stop', tunnelController_1.postTunnelStop);
    app.post('/tunnel/config', tunnelController_1.postTunnelConfig);
    app.delete('/tunnel/config', tunnelController_1.deleteTunnelConfig);
    app.post('/competition/upload', upload.single('lenexFile'), competitionController_1.uploadCompetition);
    app.get('/competition/summary', competitionController_1.getCompetitionSummary);
    app.get('/competition/sessions', sessionController_1.getSessions);
    app.get('/competition/event', eventController_1.getEvents);
    app.get('/competition/event/:event', eventController_1.getEvent);
    app.get('/competition/event/:event/heat/:heat', heatController_1.getHeat);
    app.get('/competition/delete', competitionController_1.deleteCompetition);
    // Serve the log file securely for the log viewer
    app.get('/logs/competition.log', logController_1.getCompetitionLog);
    // Device management routes
    app.get('/devices', devicesController_1.getDevicesList);
}
