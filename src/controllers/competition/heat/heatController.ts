import { Request, Response } from 'express';
import Competition from '../../../modules/competition';

export function getHeat(req: Request, res: Response) {
  const eventNumber = parseInt(req.params.event, 10);
  const heatNumber = parseInt(req.params.heat, 10);
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  if (!eventNumber || !heatNumber) {
    res.status(400).send('Missing eventNumber or heatNumber');
    return;
  }
  try {
    const result = Competition.getHeat(meetIndex, sessionIndex, eventNumber, heatNumber);
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
