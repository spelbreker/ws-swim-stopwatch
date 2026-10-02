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
  afterEach(() => {
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

  it('GET /exports/splashme/:file returns 404 for a missing heat file', async () => {
    jest.spyOn(splashExport, 'heatFilePath').mockReturnValue('/nonexistent/Event1-Heat1.txt');
    const res = await request(app).get('/exports/splashme/Event1-Heat1.txt');
    expect(res.status).toBe(404);
  });

  it('GET /exports/splashme/:file downloads the heat file as attachment', async () => {
    jest.spyOn(splashExport, 'heatFilePath').mockReturnValue(__filename);
    const res = await request(app).get('/exports/splashme/Event1-Heat1.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="Event1-Heat1.txt"');
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
