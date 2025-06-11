"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../src/websockets/logger");
describe('logger', () => {
    const logPath = path_1.default.join(process.cwd(), 'logs', 'competition.log');
    beforeEach(() => {
        // Clear the log file before each test
        if (fs_1.default.existsSync(logPath)) {
            fs_1.default.unlinkSync(logPath);
        }
        (0, logger_1.resetLoggerState)();
    });
    it('should log a START event', () => {
        (0, logger_1.logStart)('1', '2', 1718000000000);
        const log = fs_1.default.readFileSync(logPath, 'utf8');
        expect(log).toMatch(/START - Event: 1, Heat: 2, Timestamp: 1718000000000/);
        expect(log).toMatch(/====================================================================/);
    });
    it('should log a STOP event and reset lastStartTimestamp', () => {
        (0, logger_1.logStop)(1718000001234);
        const log = fs_1.default.readFileSync(logPath, 'utf8');
        expect(log).toMatch(/STOP - Timestamp: 1718000001234/);
        expect(log).toMatch(/--------------------------------------------------------------------/);
    });
    it('should log a LAP event with correct elapsed time', () => {
        (0, logger_1.logStart)('1', '2', 1718000000000);
        (0, logger_1.logLap)(3, 1718000002345);
        const log = fs_1.default.readFileSync(logPath, 'utf8');
        // Elapsed: 2345ms
        expect(log).toMatch(/LAP - Lane: 3, Time: 00:02.345, Timestamp: 1718000002345/);
    });
    it('should log a LAP event with elapsed 0 if no start', () => {
        (0, logger_1.logLap)(5, 1718000002345);
        const log = fs_1.default.readFileSync(logPath, 'utf8');
        expect(log).toMatch(/LAP - Lane: 5, Time: 00:00.345, Timestamp: 1718000002345/);
    });
});
