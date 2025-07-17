import { Express } from 'express';
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

// Register all competition-related routes
export function registerRoutes(app: Express, upload: multer.Multer) {
  app.post('/competition/upload', upload.single('lenexFile'), uploadCompetition);
  app.get('/competition/summary', getCompetitionSummary);
  app.get('/competition/sessions', getSessions);
  app.get('/competition/event', getEvents);
  app.get('/competition/event/:event', getEvent);
  app.get('/competition/event/:event/heat/:heat', getHeat);
  app.get('/competition/delete', deleteCompetition);

  // Serve the log file securely for the log viewer
  app.get('/logs/competition.log', getCompetitionLog);
}
