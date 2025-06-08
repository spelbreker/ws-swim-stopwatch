"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
jest.mock('../../../../src/modules/competition');
const eventController = __importStar(require("../../../../src/controllers/competition/event/eventController"));
const competitionModule = __importStar(require("../../../../src/modules/competition"));
const app = (0, express_1.default)();
app.get('/competition/event', eventController.getEvents);
app.get('/competition/event/:event', eventController.getEvent);
describe('eventController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getEvents', () => {
        it('should return 500 if module throws', async () => {
            competitionModule.getEvents.mockImplementation(() => { throw new Error('fail'); });
            const res = await (0, supertest_1.default)(app).get('/competition/event');
            expect(res.status).toBe(500);
            expect(res.text).toMatch(/Error getting events/);
        });
        it('should return events if module returns data', async () => {
            competitionModule.getEvents.mockReturnValue([{ number: 1 }, { number: 2 }]);
            const res = await (0, supertest_1.default)(app).get('/competition/event');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0].number).toBe(1);
        });
    });
    describe('getEvent', () => {
        it('should return 404 if event not found', async () => {
            competitionModule.getEvent.mockReturnValue(null);
            const res = await (0, supertest_1.default)(app).get('/competition/event/2');
            expect(res.status).toBe(404);
            expect(res.text).toMatch(/Event not found/);
        });
        it('should return event if found', async () => {
            competitionModule.getEvent.mockReturnValue({ number: 1 });
            const res = await (0, supertest_1.default)(app).get('/competition/event/1');
            expect(res.status).toBe(200);
            expect(res.body.number).toBe(1);
        });
        it('should return 500 if module throws', async () => {
            competitionModule.getEvent.mockImplementation(() => { throw new Error('fail'); });
            const res = await (0, supertest_1.default)(app).get('/competition/event/1');
            expect(res.status).toBe(500);
            expect(res.text).toMatch(/Error getting event/);
        });
    });
});
