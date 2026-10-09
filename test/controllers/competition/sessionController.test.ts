import request from 'supertest';
import express from 'express';
import { getSessions } from '../../../src/controllers/competition/sessionController';
import Competition from '../../../src/modules/competition';

const app = express();
app.use(express.json());
app.get('/competition/sessions', getSessions);

describe('sessionController', () => {
  describe('getSessions', () => {
    let spy: jest.SpyInstance;
    afterEach(() => { if (spy) spy.mockRestore(); });

    it('should return 500 if module throws', async () => {
      spy = jest.spyOn(Competition, 'getSessions').mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/sessions');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting sessions/);
    });

    it('should return sessions if module returns data', async () => {
      const mockSessions = [
        {
          date: '2025-02-09',
          number: 1,
          events: []
        },
        {
          date: '2025-02-10',
          number: 2,
          events: []
        }
      ];
      spy = jest.spyOn(Competition, 'getSessions').mockReturnValue(mockSessions);
      const res = await request(app).get('/competition/sessions');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual(mockSessions);
    });

    it('should handle meet parameter', async () => {
      const mockSessions = [
        {
          date: '2025-02-09',
          number: 1,
          events: []
        }
      ];
      spy = jest.spyOn(Competition, 'getSessions').mockReturnValue(mockSessions);
      const res = await request(app).get('/competition/sessions?meet=1');
      expect(res.status).toBe(200);
      expect(Competition.getSessions).toHaveBeenCalledWith(1);
    });

    it('should use default meet index when meet parameter is not provided', async () => {
      const mockSessions = [
        {
          date: '2025-02-09',
          number: 1,
          events: []
        }
      ];
      spy = jest.spyOn(Competition, 'getSessions').mockReturnValue(mockSessions);
      const res = await request(app).get('/competition/sessions');
      expect(res.status).toBe(200);
      expect(Competition.getSessions).toHaveBeenCalledWith(0);
    });
  });
});
