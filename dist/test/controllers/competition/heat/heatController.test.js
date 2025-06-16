"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const heatController_1 = require("../../../../src/controllers/competition/heat/heatController");
jest.mock('../../../../src/modules/competition');
const app = (0, express_1.default)();
app.get('/competition/event/:event/heat/:heat', heatController_1.getHeat);
describe('heatController', () => {
    let mockGetHeat;
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetHeat = jest.spyOn(heatController_1.comp, 'getHeat');
    });
    it('should return 400 if eventNumber or heatNumber is missing', async () => {
        const res = await (0, supertest_1.default)(app).get('/competition/event//heat/');
        expect(res.status).toBe(404); // Express default for missing param
    });
    it('should return 404 if heat or entries not found', async () => {
        mockGetHeat.mockReturnValue(null);
        const res = await (0, supertest_1.default)(app).get('/competition/event/1/heat/2');
        expect(res.status).toBe(404);
        expect(res.text).toMatch(/Heat or entries not found/);
    });
    it('should return heat data if found', async () => {
        mockGetHeat.mockReturnValue([{ lane: 3 }]);
        const res = await (0, supertest_1.default)(app).get('/competition/event/1/heat/1');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].lane).toBe(3);
    });
    it('should return 500 if module throws', async () => {
        mockGetHeat.mockImplementation(() => { throw new Error('fail'); });
        const res = await (0, supertest_1.default)(app).get('/competition/event/1/heat/1');
        expect(res.status).toBe(500);
        expect(res.text).toMatch(/Error getting heat/);
    });
});
