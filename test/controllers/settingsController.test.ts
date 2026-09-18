import request from 'supertest';
import express from 'express';
import { getSettings, postSettings } from '../../src/controllers/settingsController';
import * as settings from '../../src/modules/settings';

const app = express();
app.use(express.json());
app.get('/settings', getSettings);
app.post('/settings', postSettings);

describe('settingsController', () => {
  let loadSpy: jest.SpyInstance;
  let saveSpy: jest.SpyInstance;

  beforeEach(() => {
    loadSpy = jest.spyOn(settings, 'loadSettings').mockReturnValue({ poolLength: 25, splitCooldownSec: 12 });
    saveSpy = jest.spyOn(settings, 'saveSettings').mockReturnValue(true);
  });

  afterEach(() => {
    loadSpy.mockRestore();
    saveSpy.mockRestore();
  });

  it('GET /settings returns current settings', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ poolLength: 25, splitCooldownSec: 12 });
  });

  it('POST /settings saves valid settings', async () => {
    const res = await request(app).post('/settings').send({ poolLength: 50, splitCooldownSec: 20 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, settings: { poolLength: 50, splitCooldownSec: 20 } });
    expect(saveSpy).toHaveBeenCalledWith({ poolLength: 50, splitCooldownSec: 20 });
  });

  it('POST /settings rejects invalid poolLength', async () => {
    const res = await request(app).post('/settings').send({ poolLength: 33, splitCooldownSec: 12 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/poolLength/);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it.each([0, 61, 12.5, '12', undefined])('POST /settings rejects splitCooldownSec=%p', async (value) => {
    const res = await request(app).post('/settings').send({ poolLength: 25, splitCooldownSec: value });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/splitCooldownSec/);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('POST /settings returns 500 when save fails', async () => {
    saveSpy.mockReturnValue(false);
    const res = await request(app).post('/settings').send({ poolLength: 25, splitCooldownSec: 12 });
    expect(res.status).toBe(500);
  });
});
