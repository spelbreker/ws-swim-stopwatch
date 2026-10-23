import request from 'supertest';
import express from 'express';
import {
  getBanners,
  receiveBannerFile,
  uploadBanner,
  putBannerConfig,
  removeBanner,
} from '../../src/controllers/bannerController';
import * as banners from '../../src/modules/banners';
import * as websocket from '../../src/websockets/websocket';

const app = express();
app.get('/banners', getBanners);
app.put('/banners/config', express.json(), putBannerConfig);
app.post('/banners/upload', receiveBannerFile, uploadBanner);
app.delete('/banners/:id', removeBanner);

const banner: banners.Banner = { id: 'b1', filename: 'b1.png', durationSec: 10, enabled: true };
const config: banners.BannerConfig = { showDisclaimer: true, disclaimerSec: 10, banners: [banner] };

describe('bannerController', () => {
  let broadcastSpy: jest.SpyInstance;

  beforeEach(() => {
    broadcastSpy = jest.spyOn(websocket, 'broadcast').mockImplementation(() => undefined);
    jest.spyOn(banners, 'loadBanners').mockReturnValue(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /banners returns the config', async () => {
    const res = await request(app).get('/banners');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(config);
  });

  it('POST /banners/upload stores the image and notifies screens', async () => {
    const addSpy = jest.spyOn(banners, 'addBanner').mockReturnValue(banner);
    const res = await request(app).post('/banners/upload').attach('banner', Buffer.from('img'), 'a.png');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, banner });
    expect(addSpy).toHaveBeenCalledWith(Buffer.from('img'));
    expect(broadcastSpy).toHaveBeenCalledWith({ type: 'banners-updated' });
  });

  it('POST /banners/upload returns 400 without a file', async () => {
    const res = await request(app).post('/banners/upload');
    expect(res.status).toBe(400);
  });

  it('POST /banners/upload returns 400 for a file over the size limit', async () => {
    const res = await request(app)
      .post('/banners/upload')
      .attach('banner', Buffer.alloc(banners.MAX_BANNER_BYTES + 1), 'big.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 MB/);
  });

  it.each([
    ['invalid-image', 400],
    ['limit-reached', 400],
    ['write-failed', 500],
  ] as const)('POST /banners/upload maps %s to %i', async (result, status) => {
    jest.spyOn(banners, 'addBanner').mockReturnValue(result);
    const res = await request(app).post('/banners/upload').attach('banner', Buffer.from('x'), 'x.png');
    expect(res.status).toBe(status);
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('PUT /banners/config saves a valid update', async () => {
    jest.spyOn(banners, 'parseConfigUpdate').mockReturnValue(config);
    const saveSpy = jest.spyOn(banners, 'saveBanners').mockReturnValue(true);
    const res = await request(app).put('/banners/config').send({ any: 'body' });
    expect(res.status).toBe(200);
    expect(saveSpy).toHaveBeenCalledWith(config);
    expect(broadcastSpy).toHaveBeenCalledWith({ type: 'banners-updated' });
  });

  it('PUT /banners/config returns 400 for an invalid update and 500 on save failure', async () => {
    const parseSpy = jest.spyOn(banners, 'parseConfigUpdate').mockReturnValue(null);
    expect((await request(app).put('/banners/config').send({})).status).toBe(400);
    parseSpy.mockReturnValue(config);
    jest.spyOn(banners, 'saveBanners').mockReturnValue(false);
    expect((await request(app).put('/banners/config').send({})).status).toBe(500);
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['deleted', 200],
    ['not-found', 404],
    ['write-failed', 500],
  ] as const)('DELETE /banners/:id maps %s to %i', async (result, status) => {
    const deleteSpy = jest.spyOn(banners, 'deleteBanner').mockReturnValue(result);
    const res = await request(app).delete('/banners/b1');
    expect(res.status).toBe(status);
    expect(deleteSpy).toHaveBeenCalledWith('b1');
  });
});
