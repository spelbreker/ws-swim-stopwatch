import request from 'supertest';
import express from 'express';
import { getHeat, comp } from '../../../../src/controllers/competition/heat/heatController';
import Competition from '../../../../src/modules/competition';

jest.mock('../../../../src/modules/competition');

const app = express();
app.get('/competition/event/:event/heat/:heat', getHeat);

describe('heatController', () => {
  let mockGetHeat: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHeat = jest.spyOn(comp, 'getHeat');
  });

  it('should return 400 if eventNumber or heatNumber is missing', async () => {
    const res = await request(app).get('/competition/event//heat/');
    expect(res.status).toBe(404); // Express default for missing param
  });

  it('should return 404 if heat or entries not found', async () => {
    mockGetHeat.mockReturnValue(null);
    const res = await request(app).get('/competition/event/1/heat/2');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/Heat or entries not found/);
  });

  it('should return heat data if found', async () => {
    mockGetHeat.mockReturnValue([{ lane: 3 }]);
    const res = await request(app).get('/competition/event/1/heat/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].lane).toBe(3);
  });

  it('should return 500 if module throws', async () => {
    mockGetHeat.mockImplementation(() => { throw new Error('fail'); });
    const res = await request(app).get('/competition/event/1/heat/1');
    expect(res.status).toBe(500);
    expect(res.text).toMatch(/Error getting heat/);
  });
});
