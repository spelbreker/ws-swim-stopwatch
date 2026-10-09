import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

function downloadFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `competition-${stamp}.log`;
}

function logFilePath(): string {
  return path.join(process.cwd(), 'logs', 'competition.log');
}

export function getCompetitionLog(req: Request, res: Response) {
  const logPath = logFilePath();
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('Logbestand niet gevonden.');
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const tail = parseInt(String(req.query.tail), 10);
    if (tail > 0) {
      // Only the last lines: the remote polls the log and does not need the whole file.
      const lines = data.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      res.send(lines.slice(-tail).join('\n'));
      return;
    }
    if (req.query.download !== undefined) {
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename()}"`);
    }
    res.send(data);
  });
}

// Truncate rather than unlink: the logger appends per write, and the viewer then shows an empty log instead of a 404.
export function clearCompetitionLog(_req: Request, res: Response) {
  fs.writeFile(logFilePath(), '', (err) => {
    if (err) {
      res.status(500).send('Logbestand kon niet worden gewist.');
      return;
    }
    res.status(204).end();
  });
}
