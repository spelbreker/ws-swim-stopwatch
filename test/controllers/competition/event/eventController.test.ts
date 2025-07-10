import request from 'supertest';
import express from 'express';
import { getEvents, getEvent } from '../../../../src/controllers/competition/event/eventController';
import Competition from '../../../../src/modules/competition';
import { Gender, Stroke } from '../../../../src/types/competition-types';

jest.mock('../../../../src/modules/competition');

const app = express();
app.get('/competition/event', getEvents);
app.get('/competition/event/:event', getEvent);

describe('eventController', () => {
  let getEventsSpy: jest.SpyInstance;
  let getEventSpy: jest.SpyInstance;
  let getFirstMeetSessionSpy: jest.SpyInstance;
  
  beforeEach(() => {
    // Mock the helper method to return default values
    getFirstMeetSessionSpy = jest.spyOn(Competition, 'getFirstMeetSession').mockReturnValue({
      meetNumber: 1,
      sessionNumber: 1,
    });
  });
  
  afterEach(() => {
    if (getEventsSpy) getEventsSpy.mockRestore();
    if (getEventSpy) getEventSpy.mockRestore();
    if (getFirstMeetSessionSpy) getFirstMeetSessionSpy.mockRestore();
  });
  describe('getEvents', () => {
    it('should return 500 if module throws', async () => {
      getEventsSpy = jest.spyOn(Competition, 'getEvents').mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/event');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting events/);
    });
    it('should return events if module returns data', async () => {
      getEventsSpy = jest.spyOn(Competition, 'getEvents').mockReturnValue([
        {
          number: 1,
          order: 1,
          eventid: 'E1',
          gender: Gender.M,
          swimstyle: { relaycount: 1, stroke: Stroke.FREE, distance: 100 },
          heats: [],
        },
        {
          number: 2,
          order: 2,
          eventid: 'E2',
          gender: Gender.F,
          swimstyle: { relaycount: 1, stroke: Stroke.BACK, distance: 200 },
          heats: [],
        },
      ]);
      const res = await request(app).get('/competition/event');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
       
      const arr: unknown = res.body;
      if (
        Array.isArray(arr)
        && arr.length > 0
        && typeof arr[0] === 'object'
        && arr[0] !== null
        && Object.prototype.hasOwnProperty.call(arr[0], 'number')
      ) {
        expect((arr[0] as { number: number }).number).toBe(1);
      }
    });
  });

  describe('getEvent', () => {
    it('should return 404 if event not found', async () => {
      getEventSpy = jest.spyOn(Competition, 'getEvent').mockReturnValue(null);
      const res = await request(app).get('/competition/event/2');
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Event not found/);
    });
    it('should return event if found', async () => {
      getEventSpy = jest.spyOn(Competition, 'getEvent').mockReturnValue({
        number: 1,
        order: 1,
        eventid: 'E1',
        gender: Gender.M,
        swimstyle: { relaycount: 1, stroke: Stroke.FREE, distance: 100 },
        heats: [],
      });
      const res = await request(app).get('/competition/event/1');
      expect(res.status).toBe(200);
      if (res.body && typeof res.body === 'object' && 'number' in res.body) {
        expect((res.body as { number: number }).number).toBe(1);
      }
    });
    it('should return 500 if module throws', async () => {
      getEventSpy = jest.spyOn(Competition, 'getEvent').mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/event/1');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error getting event/);
    });
  });
});
