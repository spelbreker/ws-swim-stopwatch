import { Request, Response } from 'express';
import Competition from '../../modules/competition';

export function getSessions(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  try {
    const sessions = Competition.getSessions(meetIndex);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(sessions));
  } catch (e) {
    console.error('[getSessions] Error getting sessions:', e);
    const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
    res.status(500).send(`Error getting sessions: ${errorMsg}`);
  }
}
