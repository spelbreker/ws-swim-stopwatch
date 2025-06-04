import { Request, Response } from 'express';
import { getEvents as getEventsModule, getEvent as getEventModule } from '../../../modules/competition';

export function getEvents(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  try {
    const events = getEventsModule(meetIndex, sessionIndex);
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
    res.status(404).send('Missing eventNumber');
    return;
  }
  try {
    const event = getEventModule(meetIndex, sessionIndex, eventNumber);
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
