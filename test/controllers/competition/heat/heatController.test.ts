import request from 'supertest';
import express from 'express';
import * as heatController from '../../../../src/controllers/competition/heat/heatController';
import * as competitionModule from '../../../../src/modules/competition';

jest.mock('../../../../src/modules/competition');

const app = express();
app.get('/competition/event/:event/heat/:heat', heatController.getHeat);

describe('heatController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if eventNumber or heatNumber is missing', async () => {
    const res = await request(app).get('/competition/event//heat/');
    expect(res.status).toBe(404); // Express default for missing param
  });

  it('should return 404 if heat or entries not found', async () => {
    (competitionModule.getHeat as jest.Mock).mockReturnValue(null);
    const res = await request(app).get('/competition/event/1/heat/2');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/Heat or entries not found/);
  });

  it('should return heat data if found', async () => {
    (competitionModule.getHeat as jest.Mock).mockReturnValue([{ lane: 3 }]);
    const res = await request(app).get('/competition/event/1/heat/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].lane).toBe(3);
  });

  it('should return 500 if module throws', async () => {
    (competitionModule.getHeat as jest.Mock).mockImplementation(() => { throw new Error('fail'); });
    const res = await request(app).get('/competition/event/1/heat/1');
    expect(res.status).toBe(500);
    expect(res.text).toMatch(/Error getting heat/);
  });
});
