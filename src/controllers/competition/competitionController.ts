import { Request, Response } from 'express';
import fs from 'fs';
import Competition from '../../modules/competition';

export let comp = new Competition();

export function uploadCompetition(req: Request, res: Response): void {
  const { file } = (req as any);
  if (!file) {
    res.status(400).send('No file uploaded');
    return;
  }
  const filePath = file.path;
  Competition.readAndProcessCompetitionJSON(filePath, (err) => {
    if (err) {
      res.status(500).send(`Error reading file - ${err}`);
      return;
    }
    comp.reload();
    try { require('fs').unlinkSync(filePath); } catch {}
    res.redirect('/competition/upload.html');
  });
}

export function getCompetitionSummary(req: Request, res: Response) {
  const meetIndex = req.query.meet ? parseInt(req.query.meet as string, 10) : 0;
  const sessionIndex = req.query.session ? parseInt(req.query.session as string, 10) : 0;
  try {
    const summary = comp.getMeetSummary(meetIndex, sessionIndex);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(summary));
  } catch (e) {
    res.status(500).send('Error generating summary');
  }
}

export function deleteCompetition(req: Request, res: Response) {
  try {
    if (fs.existsSync('./public/competition.json')) fs.unlinkSync('./public/competition.json');
    if (fs.existsSync('./public/events.json')) fs.unlinkSync('./public/events.json');
    if (fs.existsSync('./public/athletes.json')) fs.unlinkSync('./public/athletes.json');
    res.status(200).send('Competition deleted');
  } catch (e) {
    res.status(500).send('Error deleting competition');
  }
}
