import fs from 'fs';
import path from 'path';
import {
  logStart,
  logStop,
  logLap,
  resetLoggerState,
} from '../../src/websockets/logger';

describe('logger', () => {
  const logPath = path.join(process.cwd(), 'logs', 'competition.log');

  beforeEach(() => {
    // Clear the log file before each test
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
    resetLoggerState();
  });

  it('should log a START event', () => {
    logStart('1', '2', 1718000000000);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/START - Event: 1, Heat: 2, Timestamp: 1718000000000/);
    expect(log).toMatch(/====================================================================/);
  });

  it('should log a STOP event and reset lastStartTimestamp', () => {
    logStop(1718000001234);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/STOP - Timestamp: 1718000001234/);
    expect(log).toMatch(/--------------------------------------------------------------------/);
  });

  it('should log a LAP event with correct elapsed time', () => {
    logStart('1', '2', 1718000000000);
    logLap(3, 1718000002345);
    const log = fs.readFileSync(logPath, 'utf8');
    // Elapsed: 2345ms
    expect(log).toMatch(/LAP - Lane: 3, Time: 00:02.345, Timestamp: 1718000002345/);
  });

  it('should log a LAP event with elapsed 0 if no start', () => {
    logLap(5, 1718000002345);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/LAP - Lane: 5, Time: 00:00.345, Timestamp: 1718000002345/);
  });
});
