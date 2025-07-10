
import { Request, Response } from 'express';
import Competition from '../../../modules/competition';

/**
 * Controller to return heat data for a given event/heat/meet/session, or defaults to the first available if missing.
 *
 * Route: GET /competition/heat/:event/:heat?meet=...&session=...
 *
 * If any parameter is missing, defaults to the first available meet/session/event/heat.
 */
export function getHeat(req: Request, res: Response) {
  let eventNumber = req.params.event ? parseInt(req.params.event, 10) : undefined;
  let heatNumber = req.params.heat ? parseInt(req.params.heat, 10) : undefined;
  let meetNumber = req.query.meet ? parseInt(req.query.meet as string, 10) : undefined;
  let sessionNumber = req.query.session ? parseInt(req.query.session as string, 10) : undefined;

  if (!eventNumber || !heatNumber || !meetNumber || !sessionNumber) {
    const first = Competition.getFirstMeetSessionEventHeat();
    if (!first) {
      res.status(400).send('No meet/session/event/heat data available');
      return;
    }
    meetNumber = first.meetNumber;
    sessionNumber = first.sessionNumber;
    eventNumber = first.eventNumber;
    heatNumber = first.heatNumber;
  }
  try {
    const result = Competition.getHeat(meetNumber, sessionNumber, eventNumber, heatNumber);
    if (!result) {
      res.status(404).send('Heat or entries not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (e) {
    // Enhanced error logging for debugging
    console.error('[getHeat] Error getting heat:', {
      error: e,
      eventNumber,
      heatNumber,
      meetNumber,
      sessionNumber,
      stack: e instanceof Error ? e.stack : undefined,
    });
    const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
    res.status(500).send(`Error getting heat: ${errorMsg}`);
  }
}
