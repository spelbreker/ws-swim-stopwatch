import request from 'supertest';
import express from 'express';
import { getSessions, getSessionSummary } from '../../../src/controllers/competition/sessionController';
import Competition from '../../../src/modules/competition';

const app = express();
app.use(express.json());
app.get('/competition/sessions', getSessions);
app.get('/competition/session/:session/summary', getSessionSummary);

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

describe('sessionController getSessionSummary', () => {
  let spy: jest.SpyInstance;
  afterEach(() => { if (spy) spy.mockRestore(); });

  it('returns the summary of a session', async () => {
    const summary = { number: 2, date: '2025-02-10', startTime: '13:30', eventCount: 14, heatCount: 58, swimmerCount: 412 };
    spy = jest.spyOn(Competition, 'getSessionSummary').mockReturnValue(summary);
    const res = await request(app).get('/competition/session/2/summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(summary);
    expect(Competition.getSessionSummary).toHaveBeenCalledWith(0, 2);
  });

  it('passes the meet parameter', async () => {
    spy = jest.spyOn(Competition, 'getSessionSummary').mockReturnValue({
      number: 1, date: '', startTime: null, eventCount: 0, heatCount: 0, swimmerCount: 0,
    });
    await request(app).get('/competition/session/1/summary?meet=1');
    expect(Competition.getSessionSummary).toHaveBeenCalledWith(1, 1);
  });

  it('returns 400 for a non-numeric session', async () => {
    const res = await request(app).get('/competition/session/abc/summary');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the session does not exist', async () => {
    spy = jest.spyOn(Competition, 'getSessionSummary').mockImplementation(() => { throw new Error('Session with number 9 not found'); });
    const res = await request(app).get('/competition/session/9/summary');
    expect(res.status).toBe(404);
  });

  it('returns 500 on other errors', async () => {
    spy = jest.spyOn(Competition, 'getSessionSummary').mockImplementation(() => { throw new Error('Missing competition.json'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/competition/session/1/summary');
    expect(res.status).toBe(500);
    expect(res.text).toMatch(/Error getting session summary/);
  });
});
