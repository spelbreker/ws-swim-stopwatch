import fs from 'fs';
import path from 'path';
import {
  logStart,
  logReset,
  logSplit,
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

  it('should log a RESET event and reset lastStartTimestamp', () => {
    logReset(1718000001234);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/RESET - Timestamp: 1718000001234/);
    expect(log).toMatch(/--------------------------------------------------------------------/);
  });

  it('should log a SPLIT event with correct elapsed time', () => {
    logStart('1', '2', 1718000000000);
    logSplit(3, 1718000002345);
    const log = fs.readFileSync(logPath, 'utf8');
    // Elapsed: 2345ms
    expect(log).toMatch(/SPLIT - Lane: 3, Time: 00:02.345, Timestamp: 1718000002345/);
  });

  it('should log a SPLIT event using derived elapsed time when no start', () => {
    logSplit(5, 1718000002345);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/SPLIT - Lane: 5, Time: 00:00.345, Timestamp: 1718000002345/);
  });

  it('should log a SPLIT event with elapsed_ms when provided', () => {
    logStart('1', '2', 1718000000000);
    logSplit(3, 1718000002345, 2345);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/SPLIT - Lane: 3, Time: 00:02.345, Timestamp: 1718000002345, Elapsed: 2345ms/);
  });
});
