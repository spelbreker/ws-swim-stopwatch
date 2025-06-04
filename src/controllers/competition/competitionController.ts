import fs from 'fs';
import { Request, Response } from 'express';
import { getMeetSummary as getMeetSummaryModule, readAndProcessCompetitionJSON, deleteCompetition as deleteCompetitionModule } from '../../modules/competition';
import { CompetitionData } from '../../types/types';

function loadCompetitionData(): CompetitionData | null {
  if (!fs.existsSync('./public/competition.json')) return null;
  return JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
}

export function uploadCompetition(req: Request, res: Response): void {
  const file = (req as any).file;
  if (!file) {
    res.status(400).send('No file uploaded');
    return;
  }
  const filePath = file.path;
  readAndProcessCompetitionJSON(filePath, (err) => {
    if (err) {
      res.status(500).send(`Error reading file - ${err}`);
      return;
    }
    try { fs.unlinkSync(filePath); } catch {}
    res.redirect('/competition/upload.html');
  });
}

export function getCompetitionSummary(req: Request, res: Response) {
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

export function deleteCompetition(req: Request, res: Response) {
  try {
    deleteCompetitionModule();
    res.status(200).send('Competition deleted');
  } catch (e) {
    res.status(500).send('Error deleting competition');
  }
}
