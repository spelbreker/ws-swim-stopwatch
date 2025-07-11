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
  // Ensure route parameters are present; if missing, return 404
  if (!req.params.event || !req.params.heat) {
    res.status(400).send('Missing event or heat parameters');
    return;
  }
  const eventNumber = req.params.event ? parseInt(req.params.event, 10) : undefined;
  const heatNumber = req.params.heat ? parseInt(req.params.heat, 10) : undefined;
  const meetNumber = req.query.meet ? parseInt(req.query.meet as string, 10) : undefined;
  const sessionNumber = req.query.session ? parseInt(req.query.session as string, 10) : undefined;

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
