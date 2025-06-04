import fs from 'fs';
import { Request, Response } from 'express';
import {
  getMeetSummary as getMeetSummaryModule,
  getEvents as getEventsModule,
  getEvent as getEventModule,
  getHeat as getHeatModule,
  readAndProcessCompetitionJSON,
  deleteCompetition as deleteCompetitionModule,
} from '../modules/competition';
import { CompetitionData } from '../types/types';

function loadCompetitionData(): CompetitionData | null {
  if (!fs.existsSync('./public/competition.json')) return null;
  return JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
}

export function getMeetSummary(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  const data = loadCompetitionData();
  if (!data) {
    res.status(500).send('Missing competition.json');
    return;
  }
  try {
    const summary = getMeetSummaryModule(data, meetIndex, sessionIndex);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(summary));
  } catch (e) {
    res.status(500).send('Error generating summary');
  }
}

export function getEvents(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  const data = loadCompetitionData();
  if (!data) {
    res.status(500).send('Missing competition.json');
    return;
  }
  try {
    const events = getEventsModule(data, meetIndex, sessionIndex);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
  } catch (e) {
    res.status(500).send('Error getting events');
  }
}

export function getEvent(req: Request, res: Response) {
  const eventNumber = parseInt(req.params.event, 10);
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  if (!eventNumber) {
    res.status(400).send('Missing eventNumber');
    return;
  }
  const data = loadCompetitionData();
  if (!data) {
    res.status(500).send('Missing competition.json');
    return;
  }
  try {
    const event = getEventModule(data, meetIndex, sessionIndex, eventNumber);
    if (!event) {
      res.status(404).send('Event not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(event));
  } catch (e) {
    res.status(500).send('Error getting event');
  }
}

export function getHeat(req: Request, res: Response) {
  const eventNumber = parseInt(req.params.event, 10);
  const heatNumber = parseInt(req.params.heat, 10);
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  if (!eventNumber || !heatNumber) {
    res.status(400).send('Missing eventNumber or heatNumber');
    return;
  }
  const data = loadCompetitionData();
  if (!data) {
    res.status(500).send('Missing competition.json');
    return;
  }
  try {
    const result = getHeatModule(data, meetIndex, sessionIndex, eventNumber, heatNumber);
    if (!result) {
      res.status(404).send('Heat or entries not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (e) {
    res.status(500).send('Error getting heat');
  }
}

export function handleFileUpload(req: Request, res: Response): void {
  const file = (req as any).file;
  if (!file) {
    res.status(400).send('No file uploaded');
    return;
  }
  const filePath = file.path;
  readAndProcessCompetitionJSON(filePath, (err, result) => {
    if (err) {
      res.status(500).send(`Error reading file - ${err}`);
      return;
    }
    // Remove uploaded file after processing
    try {
      require('fs').unlinkSync(filePath);
    } catch {}
    res.redirect('/competition/upload.html');
  });
}

export function deleteCompetition(req: Request, res: Response) {
  try {
    deleteCompetitionModule();
    res.status(200).send('Competition deleted');
  } catch (e) {
    res.status(500).send('Error deleting competition');
  }
}
