import { Request, Response } from 'express';
import fs from 'fs';
import Competition from '../../modules/competition';

export function uploadCompetition(req: Request, res: Response): void {
  // Use object destructuring for file
  const { file } = req as Request & { file?: Express.Multer.File };
  if (!file) {
    res.status(400).send('No file uploaded');
    return;
  }
  const filePath: string = file.path;
  Competition.readAndProcessCompetitionJSON(filePath, (err: string | Error | null) => {
    if (err) {
      res.status(500).send(`Error reading file - ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkErr) {
      // Log error for dev/ops, but do not block user

      console.error('Failed to delete uploaded file:', unlinkErr);
    }
    res.redirect('/competition/upload.html');
  });
}

export function getCompetitionSummary(req: Request, res: Response) {
  /**
   * Accept meet/session as number (not index). If missing, default to first available.
   */
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
    const summary = Competition.getMeetSummary(meetNumber, sessionNumber);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(summary));
  } catch {
    res.status(500).send('Error generating summary');
  }
}

export function deleteCompetition(req: Request, res: Response) {
  try {
    if (fs.existsSync('./public/competition.json')) fs.unlinkSync('./public/competition.json');
    if (fs.existsSync('./public/events.json')) fs.unlinkSync('./public/events.json');
    if (fs.existsSync('./public/athletes.json')) fs.unlinkSync('./public/athletes.json');
    res.status(200).send('Competition deleted');
  } // eslint-disable-next-line @typescript-eslint/no-unused-vars
  catch (_e) {
    res.status(500).send('Error deleting competition');
  }
}

/**
 * Controller to return all meets and their sessions for selector UI.
 *
 * Route: GET /competition/meets
 * Returns: Array of meets, each with sessions (see Competition.getMeetsAndSessions)
 *
 * Example response:
 * [
 *   {
 *     meetNumber: 1,
 *     name: 'Meet 1',
 *     city: 'Amsterdam',
 *     nation: 'NED',
 *     sessions: [
 *       { sessionNumber: 1, date: '2025-07-01', eventCount: 12 },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */
export function getMeetsAndSessions(req: Request, res: Response): void {
  try {
    const meets = Competition.getMeetsAndSessions();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(meets);
  } catch (err) {
    // Log error for dev/ops, but return user-friendly message
    console.error('[getMeetsAndSessions] Failed:', err);
    res.status(500).json({ error: 'Could not load meets/sessions. Please try again later.' });
  }
}
