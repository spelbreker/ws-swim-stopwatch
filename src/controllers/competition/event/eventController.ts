import fs from 'fs';
import { Request, Response } from 'express';
import { getEvents as getEventsModule, getEvent as getEventModule } from '../../../modules/competition';
import { CompetitionData } from '../../../types/types';

function loadCompetitionData(): CompetitionData | null {
  if (!fs.existsSync('./public/competition.json')) return null;
  return JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
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
