import request from 'supertest';
import express from 'express';
import { getEvents, getEvent, comp } from '../../../../src/controllers/competition/event/eventController';
import Competition from '../../../../src/modules/competition';

jest.mock('../../../../src/modules/competition');

const app = express();
app.get('/competition/event', getEvents);
app.get('/competition/event/:event', getEvent);

describe('eventController', () => {
  let mockGetEvents: jest.SpyInstance;
  let mockGetEvent: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEvents = jest.spyOn(comp, 'getEvents');
    mockGetEvent = jest.spyOn(comp, 'getEvent');
  });

  describe('getEvents', () => {
    it('should return 500 if module throws', async () => {
      mockGetEvents.mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/event');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting events/);
    });
    it('should return events if module returns data', async () => {
      mockGetEvents.mockReturnValue([{ number: 1 }, { number: 2 }]);
      const res = await request(app).get('/competition/event');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].number).toBe(1);
    });
  });

  describe('getEvent', () => {
    it('should return 404 if event not found', async () => {
      mockGetEvent.mockReturnValue(null);
      const res = await request(app).get('/competition/event/2');
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Event not found/);
    });
    it('should return event if found', async () => {
      mockGetEvent.mockReturnValue({ number: 1 });
      const res = await request(app).get('/competition/event/1');
      expect(res.status).toBe(200);
      expect(res.body.number).toBe(1);
    });
    it('should return 500 if module throws', async () => {
      mockGetEvent.mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/event/1');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting event/);
    });
  });
});
