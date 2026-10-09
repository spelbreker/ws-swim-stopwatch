import request from 'supertest';
import express from 'express';
import fs from 'fs';
import { getCompetitionLog, clearCompetitionLog } from '../../../src/controllers/competition/logController';

const app = express();
app.get('/logs/competition.log', getCompetitionLog);
app.delete('/logs/competition.log', clearCompetitionLog);

describe('logController', () => {
  let readSpy: jest.SpyInstance;

  afterEach(() => readSpy?.mockRestore());

  const mockLog = (content: string | null) => {
    readSpy = jest.spyOn(fs, 'readFile').mockImplementation(((_p: unknown, _enc: unknown, cb: (err: Error | null, data?: string) => void) => {
      if (content === null) cb(new Error('ENOENT'));
      else cb(null, content);
    }) as unknown as typeof fs.readFile);
  };

  it('returns the log as plain text', async () => {
    mockLog('line 1\nline 2');
    const res = await request(app).get('/logs/competition.log');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.text).toBe('line 1\nline 2');
  });

  it('sends the log as an attachment when download is requested', async () => {
    mockLog('line 1');
    const res = await request(app).get('/logs/competition.log?download=1');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="competition-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.log"$/);
    expect(res.text).toBe('line 1');
  });

  it('returns only the last lines when tail is given', async () => {
    mockLog('a\nb\nc\nd\n');
    const res = await request(app).get('/logs/competition.log?tail=2');
    expect(res.status).toBe(200);
    expect(res.text).toBe('c\nd');
  });

  it('returns the whole log when tail is not a positive number', async () => {
    mockLog('a\nb\n');
    const res = await request(app).get('/logs/competition.log?tail=abc');
    expect(res.text).toBe('a\nb\n');
  });

  it('returns 404 when the log file is missing', async () => {
    mockLog(null);
    const res = await request(app).get('/logs/competition.log');
    expect(res.status).toBe(404);
  });

  describe('DELETE', () => {
    let writeSpy: jest.SpyInstance;

    afterEach(() => writeSpy?.mockRestore());

    it('truncates the log file', async () => {
      writeSpy = jest.spyOn(fs, 'writeFile').mockImplementation(((_p: unknown, _d: unknown, cb: (err: Error | null) => void) => cb(null)) as unknown as typeof fs.writeFile);
      const res = await request(app).delete('/logs/competition.log');
      expect(res.status).toBe(204);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringMatching(/logs[\\/]competition\.log$/), '', expect.any(Function));
    });

    it('returns 500 when the log cannot be cleared', async () => {
      writeSpy = jest.spyOn(fs, 'writeFile').mockImplementation(((_p: unknown, _d: unknown, cb: (err: Error | null) => void) => cb(new Error('EACCES'))) as unknown as typeof fs.writeFile);
      const res = await request(app).delete('/logs/competition.log');
      expect(res.status).toBe(500);
    });
  });
});
