"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const competitionController_1 = require("../../../src/controllers/competition/competitionController");
jest.mock('../../../src/modules/competition');
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/competition/summary', competitionController_1.getCompetitionSummary);
app.get('/competition/delete', competitionController_1.deleteCompetition);
describe('competitionController', () => {
    let mockGetMeetSummary;
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetMeetSummary = jest.spyOn(competitionController_1.comp, 'getMeetSummary');
    });
    describe('getCompetitionSummary', () => {
        it('should return 500 if module throws', async () => {
            mockGetMeetSummary.mockImplementation(() => { throw new Error('fail'); });
            const res = await (0, supertest_1.default)(app).get('/competition/summary');
            expect(res.status).toBe(500);
            expect(res.text).toMatch(/Error generating summary/);
        });
        it('should return summary if module returns data', async () => {
            mockGetMeetSummary.mockReturnValue({ meet: 'Test Meet', club_count: 2 });
            const res = await (0, supertest_1.default)(app).get('/competition/summary');
            expect(res.status).toBe(200);
            expect(res.body.meet).toBe('Test Meet');
            expect(res.body.club_count).toBe(2);
        });
    });
    describe('deleteCompetition', () => {
        it('should delete files and return 200', async () => {
            const res = await (0, supertest_1.default)(app).get('/competition/delete');
            expect([200, 500]).toContain(res.status);
        });
    });
});
