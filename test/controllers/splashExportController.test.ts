import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import express from 'express';
import {
  getSplashExports,
  downloadSplashExport,
  deleteSplashExports,
} from '../../src/controllers/splashExportController';
import * as splashExport from '../../src/modules/splashExport';

const app = express();
app.get('/exports/splashme', getSplashExports);
app.get('/exports/splashme/:file', downloadSplashExport);
app.delete('/exports/splashme', deleteSplashExports);

describe('splashExportController', () => {
  let tmp: string;
  const originalExportDir = process.env.EXPORT_DIR;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'splash-ctrl-'));
    process.env.EXPORT_DIR = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (originalExportDir === undefined) delete process.env.EXPORT_DIR;
    else process.env.EXPORT_DIR = originalExportDir;
    jest.restoreAllMocks();
  });

  it('GET /exports/splashme lists heat files', async () => {
    const files = [{ name: 'Event1-Heat1.txt', event: 1, heat: 1, backup: false, size: 20, modified: '2026-10-02T13:00:00.000Z' }];
    jest.spyOn(splashExport, 'listHeatFiles').mockReturnValue(files);
    const res = await request(app).get('/exports/splashme');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(files);
  });

  it('GET /exports/splashme returns 500 when listing fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(splashExport, 'listHeatFiles').mockImplementation(() => { throw new Error('EACCES'); });
    const res = await request(app).get('/exports/splashme');
    expect(res.status).toBe(500);
  });

  it('GET /exports/splashme/:file rejects names that are not heat files', async () => {
    const res = await request(app).get('/exports/splashme/competition.json');
    expect(res.status).toBe(400);
  });

  it('GET /exports/splashme/:file rejects encoded path traversal', async () => {
    const res = await request(app).get('/exports/splashme/..%2F..%2Fdata%2Fcompetition.json');
    expect(res.status).toBe(400);
  });

  it('GET /exports/splashme/:file returns 404 for a missing heat file', async () => {
    const res = await request(app).get('/exports/splashme/Event1-Heat1.txt');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Heat file not found' });
  });

  it('GET /exports/splashme/:file downloads the heat file as attachment', async () => {
    fs.mkdirSync(splashExport.splashExportDir(), { recursive: true });
    fs.writeFileSync(path.join(splashExport.splashExportDir(), 'Event1-Heat1.txt'), 'LANE;TIME50\r\n3;30.00\r\n');
    const res = await request(app).get('/exports/splashme/Event1-Heat1.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="Event1-Heat1.txt"');
    expect(res.text).toBe('LANE;TIME50\r\n3;30.00\r\n');
  });

  it('GET /exports/splashme/:file serves from an export directory under a dot-directory', async () => {
    process.env.EXPORT_DIR = path.join(tmp, '.hidden');
    fs.mkdirSync(splashExport.splashExportDir(), { recursive: true });
    fs.writeFileSync(path.join(splashExport.splashExportDir(), 'Event2-Heat1.txt'), 'x');
    const res = await request(app).get('/exports/splashme/Event2-Heat1.txt');
    expect(res.status).toBe(200);
  });

  it('DELETE /exports/splashme returns the number of deleted files', async () => {
    jest.spyOn(splashExport, 'clearHeatFiles').mockReturnValue(3);
    const res = await request(app).delete('/exports/splashme');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 3 });
  });

  it('DELETE /exports/splashme returns 500 when deleting fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(splashExport, 'clearHeatFiles').mockImplementation(() => { throw new Error('EBUSY'); });
    const res = await request(app).delete('/exports/splashme');
    expect(res.status).toBe(500);
  });
});
