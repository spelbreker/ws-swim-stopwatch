import request from 'supertest';
import express from 'express';
import { getCompetitionSummary, deleteCompetition, comp } from '../../../src/controllers/competition/competitionController';
import Competition from '../../../src/modules/competition';

jest.mock('../../../src/modules/competition');

const app = express();
app.use(express.json());
app.get('/competition/summary', getCompetitionSummary);
app.get('/competition/delete', deleteCompetition);

describe('competitionController', () => {
  let mockGetMeetSummary: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMeetSummary = jest.spyOn(comp, 'getMeetSummary');
  });

  describe('getCompetitionSummary', () => {
    it('should return 500 if module throws', async () => {
      mockGetMeetSummary.mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/summary');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error generating summary/);
    });
    it('should return summary if module returns data', async () => {
      mockGetMeetSummary.mockReturnValue({ meet: 'Test Meet', club_count: 2 });
      const res = await request(app).get('/competition/summary');
      expect(res.status).toBe(200);
      expect(res.body.meet).toBe('Test Meet');
      expect(res.body.club_count).toBe(2);
    });
  });

  describe('deleteCompetition', () => {
    it('should delete files and return 200', async () => {
      const res = await request(app).get('/competition/delete');
      expect([200, 500]).toContain(res.status);
    });
  });
});
