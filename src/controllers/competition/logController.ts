import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

function downloadFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `competition-${stamp}.log`;
}

export function getCompetitionLog(req: Request, res: Response) {
  const logPath = path.join(process.cwd(), 'logs', 'competition.log');
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('Logbestand niet gevonden.');
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (req.query.download !== undefined) {
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename()}"`);
    }
    res.send(data);
  });
}
