import { Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  uploadCompetition,
  getCompetitionSummary,
  deleteCompetition,
} from '../controllers/competition/competitionController';
import { getEvents, getEvent } from '../controllers/competition/event/eventController';
import { getHeat } from '../controllers/competition/heat/heatController';

// Register all competition-related routes
export function registerRoutes(app: Express, upload: multer.Multer) {
  app.post('/competition/upload', upload.single('lenexFile'), uploadCompetition);
  app.get('/competition/summary', getCompetitionSummary);
  app.get('/competition/event', getEvents);
  app.get('/competition/event/:event', getEvent);
  app.get('/competition/event/:event/heat/:heat', getHeat);
  app.get('/competition/delete', deleteCompetition);

  // Serve the log file securely for the log viewer
  app.get('/logs/competition.log', (req, res) => {
    const logPath = path.join(process.cwd(), 'logs', 'competition.log');
    fs.readFile(logPath, 'utf8', (err, data) => {
      if (err) {
        res.status(404).send('Logbestand niet gevonden.');
        return;
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(data);
    });
  });
}
