import { Express, json } from 'express';
import multer from 'multer';
import {
  uploadCompetition,
  getCompetitionSummary,
  deleteCompetition,
} from '../controllers/competition/competitionController';
import { getEvents, getEvent } from '../controllers/competition/event/eventController';
import { getHeat } from '../controllers/competition/heat/heatController';
import { getSessions } from '../controllers/competition/sessionController';
import { getCompetitionLog } from '../controllers/competition/logController';
import { getDevicesList } from '../controllers/devicesController';
import {
  getTunnelStatus,
  postTunnelStart,
  postTunnelStop,
  postTunnelConfig,
  deleteTunnelConfig,
} from '../controllers/tunnelController';

// Register all competition-related routes
export function registerRoutes(app: Express, upload: multer.Multer) {
  // JSON body parser for tunnel routes - must be registered BEFORE routes
  app.use('/tunnel', json());

  // Tunnel management routes (defined after middleware)
  app.get('/tunnel/status', getTunnelStatus);
  app.post('/tunnel/start', postTunnelStart);
  app.post('/tunnel/stop', postTunnelStop);
  app.post('/tunnel/config', postTunnelConfig);
  app.delete('/tunnel/config', deleteTunnelConfig);

  app.post('/competition/upload', upload.single('lenexFile'), uploadCompetition);
  app.get('/competition/summary', getCompetitionSummary);
  app.get('/competition/sessions', getSessions);
  app.get('/competition/event', getEvents);
  app.get('/competition/event/:event', getEvent);
  app.get('/competition/event/:event/heat/:heat', getHeat);
  app.get('/competition/delete', deleteCompetition);

  // Serve the log file securely for the log viewer
  app.get('/logs/competition.log', getCompetitionLog);

  // Device management routes
  app.get('/devices', getDevicesList);
}
