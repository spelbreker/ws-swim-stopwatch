import { Request, Response } from 'express';
import Competition from '../../modules/competition';

export function getSessions(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  try {
    const sessions = Competition.getSessions(meetIndex);
    res.json(sessions);
  } catch (e) {
    console.error('[getSessions] Error getting sessions:', e);
    const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
    res.status(500).send(`Error getting sessions: ${errorMsg}`);
  }
}

export function getSessionSummary(req: Request, res: Response) {
  const sessionNumber = parseInt(String(req.params.session), 10);
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  if (!sessionNumber) {
    res.status(400).send('Missing sessionNumber');
    return;
  }
  try {
    res.json(Competition.getSessionSummary(meetIndex, sessionNumber));
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
    if (/not found/i.test(errorMsg)) {
      res.status(404).send('Session not found');
      return;
    }
    console.error('[getSessionSummary] Error getting session summary:', e);
    res.status(500).send(`Error getting session summary: ${errorMsg}`);
  }
}
