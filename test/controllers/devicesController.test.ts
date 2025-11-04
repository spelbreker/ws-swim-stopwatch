import request from 'supertest';
import express from 'express';
import { getDevicesList } from '../../src/controllers/devicesController';
import * as websocket from '../../src/websockets/websocket';

const app = express();
app.use(express.json());
app.get('/devices', getDevicesList);

describe('devicesController', () => {
  describe('getDevicesList', () => {
    let spy: jest.SpyInstance | undefined;
    beforeEach(() => { spy = undefined; });
    afterEach(() => { spy?.mockRestore(); });

    it('should return empty array when no devices registered', async () => {
      spy = jest.spyOn(websocket, 'getDevices').mockReturnValue([]);
      const res = await request(app).get('/devices');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ devices: [] });
    });

    it('should return list of devices when devices are registered', async () => {
      const mockDevices = [
        {
          mac: '00:11:22:33:44:55',
          ip: '192.168.1.100',
          role: 'starter' as const,
          connected: true,
          lastSeen: Date.now(),
        },
        {
          mac: 'AA:BB:CC:DD:EE:FF',
          ip: '192.168.1.101',
          role: 'lane' as const,
          lane: 3,
          connected: true,
          lastSeen: Date.now(),
        },
      ];
      spy = jest.spyOn(websocket, 'getDevices').mockReturnValue(mockDevices);
      const res = await request(app).get('/devices');
      expect(res.status).toBe(200);
      expect(res.body.devices).toHaveLength(2);
      expect(res.body.devices[0].mac).toBe('00:11:22:33:44:55');
      expect(res.body.devices[0].role).toBe('starter');
      expect(res.body.devices[1].mac).toBe('AA:BB:CC:DD:EE:FF');
      expect(res.body.devices[1].role).toBe('lane');
      expect(res.body.devices[1].lane).toBe(3);
    });

    it('should return 500 if getDevices throws error', async () => {
      spy = jest.spyOn(websocket, 'getDevices').mockImplementation(() => {
        throw new Error('Database error');
      });
      const res = await request(app).get('/devices');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to get devices list' });
    });
  });
});
