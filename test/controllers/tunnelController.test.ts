import request from 'supertest';
import express from 'express';
import {
  getTunnelStatus,
  postTunnelStart,
  postTunnelStop,
  postTunnelConfig,
  deleteTunnelConfig,
} from '../../src/controllers/tunnelController';
import * as tunnel from '../../src/modules/tunnel';

const app = express();
app.use(express.json());
app.get('/tunnel/status', getTunnelStatus);
app.post('/tunnel/start', postTunnelStart);
app.post('/tunnel/stop', postTunnelStop);
app.post('/tunnel/config', postTunnelConfig);
app.delete('/tunnel/config', deleteTunnelConfig);

describe('tunnelController', () => {
  describe('getTunnelStatus', () => {
    let spy: jest.SpyInstance | undefined;
    afterEach(() => { spy?.mockRestore(); });

    it('should return tunnel status', async () => {
      spy = jest.spyOn(tunnel, 'getStatus').mockReturnValue({
        running: false,
        pid: null,
        token: null,
        autoStart: false,
        allowAllRoutes: false,
        error: null,
      });
      const res = await request(app).get('/tunnel/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        running: false,
        pid: null,
        token: null,
        autoStart: false,
        allowAllRoutes: false,
        error: null,
      });
    });

    it('should return running status when tunnel is active', async () => {
      spy = jest.spyOn(tunnel, 'getStatus').mockReturnValue({
        running: true,
        pid: 12345,
        token: '***abcd1234',
        autoStart: true,
        allowAllRoutes: false,
        error: null,
      });
      const res = await request(app).get('/tunnel/status');
      expect(res.status).toBe(200);
      expect(res.body.running).toBe(true);
      expect(res.body.pid).toBe(12345);
    });
  });

  describe('postTunnelStart', () => {
    let spy: jest.SpyInstance | undefined;
    afterEach(() => { spy?.mockRestore(); });

    it('should start tunnel successfully', async () => {
      spy = jest.spyOn(tunnel, 'startTunnel').mockReturnValue({ success: true });
      const res = await request(app).post('/tunnel/start').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return error when tunnel start fails', async () => {
      spy = jest.spyOn(tunnel, 'startTunnel').mockReturnValue({
        success: false,
        error: 'No tunnel token configured',
      });
      const res = await request(app).post('/tunnel/start').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No tunnel token configured');
    });
  });

  describe('postTunnelStop', () => {
    let spy: jest.SpyInstance | undefined;
    afterEach(() => { spy?.mockRestore(); });

    it('should stop tunnel successfully', async () => {
      spy = jest.spyOn(tunnel, 'stopTunnel').mockReturnValue({ success: true });
      const res = await request(app).post('/tunnel/stop').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return error when tunnel is not running', async () => {
      spy = jest.spyOn(tunnel, 'stopTunnel').mockReturnValue({
        success: false,
        error: 'Tunnel is not running',
      });
      const res = await request(app).post('/tunnel/stop').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Tunnel is not running');
    });
  });

  describe('postTunnelConfig', () => {
    let spy: jest.SpyInstance | undefined;
    afterEach(() => { spy?.mockRestore(); });

    it('should save configuration successfully', async () => {
      spy = jest.spyOn(tunnel, 'updateConfig').mockReturnValue({ success: true });
      const res = await request(app).post('/tunnel/config').send({
        token: 'eyJtest123',
        autoStart: true,
        allowAllRoutes: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should save configuration with allowAllRoutes enabled', async () => {
      spy = jest.spyOn(tunnel, 'updateConfig').mockReturnValue({ success: true });
      const res = await request(app).post('/tunnel/config').send({
        token: 'eyJtest123',
        autoStart: true,
        allowAllRoutes: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(spy).toHaveBeenCalledWith('eyJtest123', true, true);
    });

    it('should return error when token is missing', async () => {
      const res = await request(app).post('/tunnel/config').send({
        autoStart: true,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Token is required');
    });
  });

  describe('deleteTunnelConfig', () => {
    let spy: jest.SpyInstance | undefined;
    afterEach(() => { spy?.mockRestore(); });

    it('should delete configuration successfully', async () => {
      spy = jest.spyOn(tunnel, 'deleteConfig').mockReturnValue({ success: true });
      const res = await request(app).delete('/tunnel/config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
