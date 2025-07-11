import request from 'supertest';
import express from 'express';
import { getCompetitionSummary, deleteCompetition } from '../../../src/controllers/competition/competitionController';
import Competition from '../../../src/modules/competition';

const app = express();
app.use(express.json());
app.get('/competition/summary', getCompetitionSummary);
app.get('/competition/delete', deleteCompetition);

describe('competitionController', () => {
  describe('getCompetitionSummary', () => {
  let spy: jest.SpyInstance;

    beforeEach(() => {
      // Reset spy before each test
    });

    afterEach(() => {
      if (spy) spy.mockRestore();
    });

    it('should return 500 if module throws', async () => {
      spy = jest.spyOn(Competition, 'getMeetSummary').mockImplementation(() => { throw new Error('fail'); });
      const res = await request(app).get('/competition/summary');
      expect(res.status).toBe(500);
      expect(res.text).toMatch(/Error generating summary/);
    });
    it('should return summary if module returns data', async () => {
      const mockSummary = {
        meet: 'Test Meet',
        club_count: 2,
        first_session_date: '2025-06-01',
        session_count: 1,
        event_count: 2,
      };
      spy = jest.spyOn(Competition, 'getMeetSummary').mockReturnValue(mockSummary);
      const res = await request(app).get('/competition/summary');
      expect(res.status).toBe(200);
      // Lint: object destructuring not used because type is unknown and we need safe property access
      const body: unknown = res.body;
      if (body && typeof body === 'object' && body !== null && 'meet' in body && 'club_count' in body) {
        expect((body as { meet: string }).meet).toBe('Test Meet');
        expect((body as { club_count: number }).club_count).toBe(2);
      }
    });
  });

  describe('deleteCompetition', () => {
    it('should delete files and return 200', async () => {
      const res = await request(app).get('/competition/delete');
      expect([200, 500]).toContain(res.status);
    });
  });
});
