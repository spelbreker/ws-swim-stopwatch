"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const eventController_1 = require("../../../../src/controllers/competition/event/eventController");
jest.mock('../../../../src/modules/competition');
const app = (0, express_1.default)();
app.get('/competition/event', eventController_1.getEvents);
app.get('/competition/event/:event', eventController_1.getEvent);
describe('eventController', () => {
    let mockGetEvents;
    let mockGetEvent;
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetEvents = jest.spyOn(eventController_1.comp, 'getEvents');
        mockGetEvent = jest.spyOn(eventController_1.comp, 'getEvent');
    });
    describe('getEvents', () => {
        it('should return 500 if module throws', async () => {
            mockGetEvents.mockImplementation(() => { throw new Error('fail'); });
            const res = await (0, supertest_1.default)(app).get('/competition/event');
            expect(res.status).toBe(500);
            expect(res.text).toMatch(/Error getting events/);
        });
        it('should return events if module returns data', async () => {
            mockGetEvents.mockReturnValue([{ number: 1 }, { number: 2 }]);
            const res = await (0, supertest_1.default)(app).get('/competition/event');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0].number).toBe(1);
        });
    });
    describe('getEvent', () => {
        it('should return 404 if event not found', async () => {
            mockGetEvent.mockReturnValue(null);
            const res = await (0, supertest_1.default)(app).get('/competition/event/2');
            expect(res.status).toBe(404);
            expect(res.text).toMatch(/Event not found/);
        });
        it('should return event if found', async () => {
            mockGetEvent.mockReturnValue({ number: 1 });
            const res = await (0, supertest_1.default)(app).get('/competition/event/1');
            expect(res.status).toBe(200);
            expect(res.body.number).toBe(1);
        });
        it('should return 500 if module throws', async () => {
            mockGetEvent.mockImplementation(() => { throw new Error('fail'); });
            const res = await (0, supertest_1.default)(app).get('/competition/event/1');
            expect(res.status).toBe(500);
            expect(res.text).toMatch(/Error getting event/);
        });
    });
});
