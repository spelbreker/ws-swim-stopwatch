import fs from 'fs';
import path from 'path';
import {
  formatSplashTime,
  generateFilename,
  generateTimeColumns,
  backupExistingFile,
  ensureExportDir,
  exportHeatToSplashFile,
  RaceState,
  SPLIT_IGNORE_WINDOW_MS,
} from '../../src/modules/splashExporter';

// Mock fs module
jest.mock('fs');
const mockedFs = jest.mocked(fs);

// Mock Competition module (used internally by splashExporter for getSwimDistance)
jest.mock('../../src/modules/competition', () => ({
  __esModule: true,
  default: {
    getEvent: jest.fn().mockReturnValue(null),
  },
}));

describe('splashExporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SPLIT_IGNORE_WINDOW_MS', () => {
    it('should be 3000ms', () => {
      expect(SPLIT_IGNORE_WINDOW_MS).toBe(3000);
    });
  });

  describe('formatSplashTime', () => {
    it('should format 0ms as "0.00"', () => {
      expect(formatSplashTime(0)).toBe('0.00');
    });

    it('should format negative values as "0.00"', () => {
      expect(formatSplashTime(-500)).toBe('0.00');
    });

    it('should format 35220ms as "35.22"', () => {
      expect(formatSplashTime(35220)).toBe('35.22');
    });

    it('should format 34990ms as "34.99"', () => {
      expect(formatSplashTime(34990)).toBe('34.99');
    });

    it('should format 71220ms as "1:11.22"', () => {
      expect(formatSplashTime(71220)).toBe('1:11.22');
    });

    it('should format 145110ms (2:25.11) correctly', () => {
      expect(formatSplashTime(145110)).toBe('2:25.11');
    });

    it('should format 302020ms (5:02.02) correctly', () => {
      expect(formatSplashTime(302020)).toBe('5:02.02');
    });

    it('should format 500ms as "0.05" (rounds down to centiseconds)', () => {
      // 500ms = 50 centiseconds = 0.50
      expect(formatSplashTime(500)).toBe('0.50');
    });

    it('should format 1000ms as "1.00"', () => {
      expect(formatSplashTime(1000)).toBe('1.00');
    });

    it('should format 60000ms as "1:00.00"', () => {
      expect(formatSplashTime(60000)).toBe('1:00.00');
    });

    it('should truncate sub-centisecond precision (not round)', () => {
      // 35229ms → 3522.9 centiseconds → floor to 3522 → 35.22
      expect(formatSplashTime(35229)).toBe('35.22');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with session', () => {
      expect(generateFilename(1, 2, 3)).toBe('Session1-Event2-Heat3.txt');
    });

    it('should generate filename without session when null', () => {
      expect(generateFilename(null, 2, 3)).toBe('Event2-Heat3.txt');
    });

    it('should handle string parameters', () => {
      expect(generateFilename('1', '7F', '2')).toBe('Session1-Event7F-Heat2.txt');
    });

    it('should handle event with round suffix', () => {
      expect(generateFilename(null, '7F', 1)).toBe('Event7F-Heat1.txt');
    });
  });

  describe('generateTimeColumns', () => {
    it('should return empty array for 0 splits', () => {
      expect(generateTimeColumns(200, 0)).toEqual([]);
    });

    it('should return single column for 1 split', () => {
      expect(generateTimeColumns(200, 1)).toEqual(['TIME200']);
    });

    it('should return correct columns for 200m with 4 splits', () => {
      expect(generateTimeColumns(200, 4)).toEqual(['TIME50', 'TIME100', 'TIME150', 'TIME200']);
    });

    it('should return correct columns for 400m with 8 splits', () => {
      expect(generateTimeColumns(400, 8)).toEqual([
        'TIME50', 'TIME100', 'TIME150', 'TIME200',
        'TIME250', 'TIME300', 'TIME350', 'TIME400',
      ]);
    });

    it('should return correct columns for 100m with 2 splits', () => {
      expect(generateTimeColumns(100, 2)).toEqual(['TIME50', 'TIME100']);
    });

    it('should handle non-standard distance gracefully', () => {
      // 800m with 16 splits = 50m intervals
      expect(generateTimeColumns(800, 16)).toEqual([
        'TIME50', 'TIME100', 'TIME150', 'TIME200',
        'TIME250', 'TIME300', 'TIME350', 'TIME400',
        'TIME450', 'TIME500', 'TIME550', 'TIME600',
        'TIME650', 'TIME700', 'TIME750', 'TIME800',
      ]);
    });
  });

  describe('backupExistingFile', () => {
    it('should not do anything if file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);
      backupExistingFile('/some/path/Event1-Heat1.txt');
      expect(mockedFs.renameSync).not.toHaveBeenCalled();
    });

    it('should rename existing file with timestamp suffix', () => {
      mockedFs.existsSync.mockReturnValue(true);

      // Mock Date to control timestamp
      const mockDate = new Date(2026, 1, 28, 15, 30, 45); // Feb 28, 2026 15:30:45
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      backupExistingFile('/exports/splashme/Event1-Heat1.txt');

      expect(mockedFs.renameSync).toHaveBeenCalledWith(
        '/exports/splashme/Event1-Heat1.txt',
        '/exports/splashme/Event1-Heat1_20260228-153045.txt',
      );

      jest.restoreAllMocks();
    });
  });

  describe('ensureExportDir', () => {
    it('should create directory if it does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);
      ensureExportDir();
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(path.join('exports', 'splashme')),
        { recursive: true },
      );
    });

    it('should not create directory if it already exists', () => {
      mockedFs.existsSync.mockReturnValue(true);
      ensureExportDir();
      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('exportHeatToSplashFile', () => {
    const baseTimestamp = 1709100000000; // some fixed timestamp

    function createRaceState(overrides: Partial<RaceState> = {}): RaceState {
      return {
        currentSession: 1,
        currentEvent: 2,
        currentHeat: 3,
        raceStartTimestamp: baseTimestamp,
        splitsByLane: new Map(),
        ...overrides,
      };
    }

    it('should skip export if event is missing', () => {
      const state = createRaceState({ currentEvent: null });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping export'));
      consoleSpy.mockRestore();
    });

    it('should skip export if heat is missing', () => {
      const state = createRaceState({ currentHeat: null });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should skip export if no splits recorded', () => {
      const state = createRaceState();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should export correct CSV with single split per lane', () => {
      // existsSync: first for dir check, then for backup check
      mockedFs.existsSync.mockReturnValueOnce(true)  // dir exists
        .mockReturnValueOnce(false); // file doesn't exist (no backup needed)

      const splits = new Map<number, number[]>();
      splits.set(1, [baseTimestamp + 35220]); // 35.22
      splits.set(2, [baseTimestamp + 34990]); // 34.99

      const state = createRaceState({ splitsByLane: splits });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);

      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
      const [filePath, content] = mockedFs.writeFileSync.mock.calls[0];
      expect(filePath).toContain('Session1-Event2-Heat3.txt');

      const lines = (content as string).split('\n');
      expect(lines[0]).toBe('LANE;TIME50');
      expect(lines[1]).toBe('1;35.22');
      expect(lines[2]).toBe('2;34.99');

      consoleSpy.mockRestore();
    });

    it('should export correct CSV with multiple splits per lane', () => {
      mockedFs.existsSync.mockReturnValueOnce(true)  // dir exists
        .mockReturnValueOnce(false); // no backup

      const splits = new Map<number, number[]>();
      splits.set(1, [
        baseTimestamp + 35220,   // 35.22
        baseTimestamp + 71220,   // 1:11.22
        baseTimestamp + 145110,  // 2:25.11
        baseTimestamp + 221930,  // 3:41.93
      ]);
      splits.set(2, [
        baseTimestamp + 34990,   // 34.99
        baseTimestamp + 69210,   // 1:09.21
        baseTimestamp + 144440,  // 2:24.44
        baseTimestamp + 218210,  // 3:38.21
      ]);

      const state = createRaceState({ splitsByLane: splits });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);

      const [, content] = mockedFs.writeFileSync.mock.calls[0];
      const lines = (content as string).split('\n');
      // 4 splits, fallback distance = 4*50 = 200
      expect(lines[0]).toBe('LANE;TIME50;TIME100;TIME150;TIME200');
      expect(lines[1]).toBe('1;35.22;1:11.22;2:25.11;3:41.93');
      expect(lines[2]).toBe('2;34.99;1:09.21;2:24.44;3:38.21');

      consoleSpy.mockRestore();
    });

    it('should pad lanes with fewer splits', () => {
      mockedFs.existsSync.mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const splits = new Map<number, number[]>();
      splits.set(1, [baseTimestamp + 35220, baseTimestamp + 71220]); // 2 splits
      splits.set(2, [baseTimestamp + 34990]); // 1 split

      const state = createRaceState({ splitsByLane: splits });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);

      const [, content] = mockedFs.writeFileSync.mock.calls[0];
      const lines = (content as string).split('\n');
      expect(lines[0]).toBe('LANE;TIME50;TIME100');
      expect(lines[1]).toBe('1;35.22;1:11.22');
      expect(lines[2]).toBe('2;34.99;');

      consoleSpy.mockRestore();
    });

    it('should generate filename without session when session is null', () => {
      mockedFs.existsSync.mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const splits = new Map<number, number[]>();
      splits.set(1, [baseTimestamp + 35220]);

      const state = createRaceState({ currentSession: null, splitsByLane: splits });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);

      const [filePath] = mockedFs.writeFileSync.mock.calls[0];
      expect(filePath).toContain('Event2-Heat3.txt');
      expect(filePath).not.toContain('Session');

      consoleSpy.mockRestore();
    });

    it('should backup existing file before writing', () => {
      // dir exists, file exists (trigger backup)
      mockedFs.existsSync.mockReturnValue(true);

      const mockDate = new Date(2026, 1, 28, 15, 30, 45);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) return mockDate;
        return new (Function.prototype.bind.apply(Date, [null, ...args]))();
      });

      const splits = new Map<number, number[]>();
      splits.set(1, [baseTimestamp + 35220]);

      const state = createRaceState({ splitsByLane: splits });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);

      expect(mockedFs.renameSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should sort lanes numerically in output', () => {
      mockedFs.existsSync.mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const splits = new Map<number, number[]>();
      splits.set(5, [baseTimestamp + 35220]);
      splits.set(1, [baseTimestamp + 34990]);
      splits.set(3, [baseTimestamp + 36000]);

      const state = createRaceState({ splitsByLane: splits });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      exportHeatToSplashFile(state);

      const [, content] = mockedFs.writeFileSync.mock.calls[0];
      const lines = (content as string).split('\n');
      expect(lines[1]).toMatch(/^1;/);
      expect(lines[2]).toMatch(/^3;/);
      expect(lines[3]).toMatch(/^5;/);

      consoleSpy.mockRestore();
    });
  });
});
