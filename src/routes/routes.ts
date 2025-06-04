import { Express } from 'express';
import multer from 'multer';
import {
  getMeetSummary,
  getEvents,
  getEvent,
  getHeat,
  handleFileUpload,
  deleteCompetition,
} from '../controllers/competitionController';

// Register all competition-related routes
export function registerRoutes(app: Express, upload: multer.Multer) {
  app.get('/competition/summary', getMeetSummary);
  app.post('/competition/upload', upload.single('lenexFile'), handleFileUpload);
  app.get('/competition/delete', deleteCompetition);
  app.get('/competition/event/:event', getEvent);
  app.get('/competition/event', getEvents);
  app.get('/competition/event/:event/heat/:heat', getHeat);
}
