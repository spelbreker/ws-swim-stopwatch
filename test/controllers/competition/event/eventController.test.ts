import request from 'supertest';
import express from 'express';
import * as eventController from '../../../../src/controllers/competition/event/eventController';
import * as competitionModule from '../../../../src/modules/competition';

jest.mock('../../../../src/modules/competition');

const app = express();
app.get('/competition/event', eventController.getEvents);
app.get('/competition/event/:event', eventController.getEvent);

describe('eventController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEvents', () => {
    it('should return 500 if module throws', async () => {
      (competitionModule.getEvents as jest.Mock).mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/event');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting events/);
    });
    it('should return events if module returns data', async () => {
      (competitionModule.getEvents as jest.Mock).mockReturnValue([{ number: 1 }, { number: 2 }]);
      const res = await request(app).get('/competition/event');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].number).toBe(1);
    });
  });

  describe('getEvent', () => {
    it('should return 404 if event not found', async () => {
      (competitionModule.getEvent as jest.Mock).mockReturnValue(null);
      const res = await request(app).get('/competition/event/2');
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Event not found/);
    });
    it('should return event if found', async () => {
      (competitionModule.getEvent as jest.Mock).mockReturnValue({ number: 1 });
      const res = await request(app).get('/competition/event/1');
      expect(res.status).toBe(200);
      expect(res.body.number).toBe(1);
    });
    it('should return 500 if module throws', async () => {
      (competitionModule.getEvent as jest.Mock).mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/event/1');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting event/);
    });
  });
});
