import { Request, Response } from 'express';
import Competition from '../../../modules/competition';

export function getEvents(req: Request, res: Response) {
  let meetNumber = req.query.meet ? parseInt(req.query.meet as string, 10) : undefined;
  let sessionNumber = req.query.session ? parseInt(req.query.session as string, 10) : undefined;
  if (!meetNumber || !sessionNumber) {
    const first = Competition.getFirstMeetSession();
    if (!first) {
      res.status(400).send('No meet/session data available');
      return;
    }
    meetNumber = first.meetNumber;
    sessionNumber = first.sessionNumber;
  }
  try {
    const events = Competition.getEvents(meetNumber, sessionNumber);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(events));
  } catch {
    res.status(500).send('Error getting events');
  }
}

export function getEvent(req: Request, res: Response) {
  const eventNumber = parseInt(req.params.event, 10);
  let meetNumber = req.query.meet ? parseInt(req.query.meet as string, 10) : undefined;
  let sessionNumber = req.query.session ? parseInt(req.query.session as string, 10) : undefined;
  if (!meetNumber || !sessionNumber) {
    const first = Competition.getFirstMeetSession();
    if (!first) {
      res.status(404).send('No meet/session data available');
      return;
    }
    meetNumber = first.meetNumber;
    sessionNumber = first.sessionNumber;
  }
  if (!eventNumber) {
    res.status(404).send('Missing eventNumber');
    return;
  }
  try {
    const event = Competition.getEvent(meetNumber, sessionNumber, eventNumber);
    if (!event) {
      res.status(404).send('Event not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(event));
  } catch (e) {
    // Enhanced error logging for debugging
    console.error('[getEvent] Error getting event:', {
      error: e,
      eventNumber,
      meetNumber,
      sessionNumber,
      stack: e instanceof Error ? e.stack : undefined,
    });
    const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
    res.status(500).send(`Error getting event: ${errorMsg}`);
  }
}

