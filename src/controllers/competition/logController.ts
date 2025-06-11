import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export function getCompetitionLog(req: Request, res: Response) {
  const logPath = path.join(process.cwd(), 'logs', 'competition.log');
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('Logbestand niet gevonden.');
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(data);
  });
}
