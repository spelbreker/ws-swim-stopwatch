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

function sendLog(req: Request, res: Response, text: string) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (req.query.download !== undefined) {
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename()}"`);
  }
  res.send(text);
}

const TAIL_CHUNK_BYTES = 64 * 1024;

// Reads only the end of the file: the log is append-only and grows all day, and the remote polls it.
async function readLastLines(file: string, count: number): Promise<string> {
  const handle = await fs.promises.open(file, 'r');
  try {
    const { size } = await handle.stat();
    let chunk = TAIL_CHUNK_BYTES;
    for (;;) {
      const start = Math.max(0, size - chunk);
      const buffer = Buffer.alloc(size - start);
      // The log can shrink (cleared) after stat: use only the bytes that were read.
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
      let text = buffer.toString('utf8', 0, bytesRead);
      // The chunk usually starts in the middle of a line: drop that partial line.
      if (start > 0) {
        const newline = text.indexOf('\n');
        text = newline === -1 ? '' : text.slice(newline + 1);
      }
      const lines = text.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      if (start === 0 || lines.length >= count) return lines.slice(-count).join('\n');
      chunk *= 4;
    }
  } finally {
    await handle.close();
  }
}

export function getCompetitionLog(req: Request, res: Response) {
  const logPath = logFilePath();
  const tail = parseInt(String(req.query.tail), 10);
  if (tail > 0) {
    readLastLines(logPath, tail).then(
      (text) => sendLog(req, res, text),
      (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') res.status(404).send('Logbestand niet gevonden.');
        else res.status(500).send('Logbestand kon niet worden gelezen.');
      },
    );
    return;
  }
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('Logbestand niet gevonden.');
      return;
    }
    sendLog(req, res, data);
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
