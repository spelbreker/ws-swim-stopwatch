import request from 'supertest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

  describe('tail', () => {
    let dir: string;
    let cwdSpy: jest.SpyInstance;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logtail-'));
      fs.mkdirSync(path.join(dir, 'logs'));
      cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(dir);
    });

    afterEach(() => {
      cwdSpy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    });

    const writeLog = (content: string) => fs.writeFileSync(path.join(dir, 'logs', 'competition.log'), content);

    it('returns only the last lines when tail is given', async () => {
      writeLog('a\nb\nc\nd\n');
      const res = await request(app).get('/logs/competition.log?tail=2');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toBe('c\nd');
    });

    it('sends the tailed log as an attachment when download is also requested', async () => {
      writeLog('a\nb\nc\n');
      const res = await request(app).get('/logs/competition.log?tail=2&download=1');
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="competition-.*\.log"$/);
      expect(res.text).toBe('b\nc');
    });

    it('returns everything when the log has fewer lines than tail', async () => {
      writeLog('a\nb');
      const res = await request(app).get('/logs/competition.log?tail=300');
      expect(res.text).toBe('a\nb');
    });

    it('returns an empty body for an empty log', async () => {
      writeLog('');
      const res = await request(app).get('/logs/competition.log?tail=5');
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
    });

    it('reads past the first chunk when the last lines are longer than it', async () => {
      const long = (c: string) => c.repeat(40 * 1024);
      writeLog(`first\n${long('x')}\n${long('y')}\n${long('z')}\n`);
      const res = await request(app).get('/logs/competition.log?tail=3');
      expect(res.text).toBe(`${long('x')}\n${long('y')}\n${long('z')}`);
    });

    it('does not cut a multi-byte character at the chunk boundary', async () => {
      const line = 'é'.repeat(1000);
      writeLog(`${line}\n`.repeat(200));
      const res = await request(app).get('/logs/competition.log?tail=2');
      expect(res.text).toBe(`${line}\n${line}`);
    });

    it('uses only the bytes that were read when the log shrinks during the read', async () => {
      const openSpy = jest.spyOn(fs.promises, 'open').mockResolvedValue({
        stat: async () => ({ size: 100 }),
        read: async () => ({ bytesRead: 0 }),
        close: async () => undefined,
      } as unknown as fs.promises.FileHandle);
      const res = await request(app).get('/logs/competition.log?tail=2');
      openSpy.mockRestore();
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
    });

    it('returns 500 when the log cannot be read for another reason than missing', async () => {
      const openSpy = jest.spyOn(fs.promises, 'open').mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
      const res = await request(app).get('/logs/competition.log?tail=2');
      openSpy.mockRestore();
      expect(res.status).toBe(500);
    });

    it('returns 404 when the log file is missing', async () => {
      const res = await request(app).get('/logs/competition.log?tail=2');
      expect(res.status).toBe(404);
    });
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
