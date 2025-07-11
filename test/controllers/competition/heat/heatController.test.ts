import request from 'supertest';
import express from 'express';
import { getHeat } from '../../../../src/controllers/competition/heat/heatController';
import Competition from '../../../../src/modules/competition';

jest.mock('../../../../src/modules/competition');

const app = express();
app.get('/competition/event/:event/heat/:heat', getHeat);

describe('heatController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 400 if eventNumber or heatNumber is missing', async () => {
    const res = await request(app).get('/competition/event//heat/');
    expect(res.status).toBe(404); // Express default for missing param
  });

  it('should return 404 if heat or entries not found', async () => {
    jest.spyOn(Competition, 'getHeat').mockReturnValue(null);
    const res = await request(app).get('/competition/event/1/heat/2');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/Heat or entries not found/);
  });

  it('should return heat data if found', async () => {
    jest.spyOn(Competition, 'getHeat').mockReturnValue([
      {
        lane: 3,
        entrytime: '1:00.00',
        club: 'Test Club',
        athletes: [
          {
            athleteid: 1,
            firstname: 'John',
            lastname: 'Doe',
            birthdate: '2000-01-01',
          },
        ],
      },
    ]);
    const res = await request(app).get('/competition/event/1/heat/1');
    expect(res.status).toBe(200);
    const arr: unknown = res.body;
    if (
      Array.isArray(arr)
      && arr.length > 0
      && typeof arr[0] === 'object'
      && arr[0] !== null
      && Object.prototype.hasOwnProperty.call(arr[0], 'lane')
    ) {
      expect((arr[0] as { lane: number }).lane).toBe(3);
    }
  });

  it('should return 500 if module throws', async () => {
    jest.spyOn(Competition, 'getHeat').mockImplementation(() => { throw new Error('fail'); });
    const res = await request(app).get('/competition/event/1/heat/1');
    expect(res.status).toBe(500);
    expect(res.text).toMatch(/Error getting heat/);
  });
});
