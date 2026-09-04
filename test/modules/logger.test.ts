import fs from 'fs';
import path from 'path';
import {
  logStart,
  logReset,
  logSplit,
  logIgnoredSplit,
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

  it('should log whole milliseconds for fractional timestamps', () => {
    logStart('1', '2', 1718000000000.528);
    logSplit(3, 1718000006954.6475);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/SPLIT - Lane: 3, Time: 00:06.954, Timestamp: 1718000006954.6475/);
  });

  it('should log distance and split number when provided', () => {
    logStart('1', '2', 1718000000000);
    logSplit(3, 1718000002345, undefined, 50, 1);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/SPLIT - Lane: 3, Time: 00:02.345, Timestamp: 1718000002345, Distance: 50m, Split: 1/);
  });

  it('should log an ignored split with reason and time since last split', () => {
    logStart('1', '2', 1718000000000);
    logIgnoredSplit(3, 1718000003000, 'cooldown', 655);
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/SPLIT IGNORED - Lane: 3, Reason: cooldown, Time: 00:03.000, Timestamp: 1718000003000, Since last: 655ms/);
  });

  it('should log an ignored split after finish without since-last', () => {
    logIgnoredSplit(4, 1718000003000, 'after-finish');
    const log = fs.readFileSync(logPath, 'utf8');
    expect(log).toMatch(/SPLIT IGNORED - Lane: 4, Reason: after-finish, Time: 00:00.000, Timestamp: 1718000003000$/m);
  });
});
