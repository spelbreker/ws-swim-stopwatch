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
const heatController = __importStar(require("../../../../src/controllers/competition/heat/heatController"));
const competitionModule = __importStar(require("../../../../src/modules/competition"));
const app = (0, express_1.default)();
app.get('/competition/event/:event/heat/:heat', heatController.getHeat);
describe('heatController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should return 400 if eventNumber or heatNumber is missing', async () => {
        const res = await (0, supertest_1.default)(app).get('/competition/event//heat/');
        expect(res.status).toBe(404); // Express default for missing param
    });
    it('should return 404 if heat or entries not found', async () => {
        competitionModule.getHeat.mockReturnValue(null);
        const res = await (0, supertest_1.default)(app).get('/competition/event/1/heat/2');
        expect(res.status).toBe(404);
        expect(res.text).toMatch(/Heat or entries not found/);
    });
    it('should return heat data if found', async () => {
        competitionModule.getHeat.mockReturnValue([{ lane: 3 }]);
        const res = await (0, supertest_1.default)(app).get('/competition/event/1/heat/1');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].lane).toBe(3);
    });
    it('should return 500 if module throws', async () => {
        competitionModule.getHeat.mockImplementation(() => { throw new Error('fail'); });
        const res = await (0, supertest_1.default)(app).get('/competition/event/1/heat/1');
        expect(res.status).toBe(500);
        expect(res.text).toMatch(/Error getting heat/);
    });
});
