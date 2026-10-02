import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SplashExporter,
  backupHeatFile,
  buildHeatFile,
  clearHeatFiles,
  formatSplashTime,
  heatFilePath,
  heatFilename,
  listHeatFiles,
  splashExportDir,
  LaneTimes,
} from '../../src/modules/splashExport';

const T0 = 1_718_000_000_000;

function lanes(entries: Record<number, Record<number, number>>): LaneTimes {
  return new Map(Object.entries(entries).map(([lane, times]) => [
    Number(lane),
    new Map(Object.entries(times).map(([d, ms]) => [Number(d), ms])),
  ]));
}

describe('splashExport', () => {
  let tmp: string;
  const originalExportDir = process.env.EXPORT_DIR;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'splash-'));
    process.env.EXPORT_DIR = tmp;
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (originalExportDir === undefined) delete process.env.EXPORT_DIR;
    else process.env.EXPORT_DIR = originalExportDir;
    jest.restoreAllMocks();
  });

  const read = (name: string) => fs.readFileSync(path.join(splashExportDir(), name), 'utf-8');

  describe('formatSplashTime', () => {
    it.each([
      [0, '0.00'],
      [-50, '0.00'],
      [500, '0.50'],
      [35_220, '35.22'],
      [34_999, '34.99'], // truncated, not rounded
      [60_000, '1:00.00'],
      [71_220, '1:11.22'],
      [302_020, '5:02.02'],
      [35_220.75, '35.22'], // sub-millisecond timestamps from time sync
    ])('%p ms -> %p', (ms, expected) => {
      expect(formatSplashTime(ms)).toBe(expected);
    });
  });

  describe('heatFilename', () => {
    it('builds Event{B}-Heat{C}.txt', () => {
      expect(heatFilename(7, 3)).toBe('Event7-Heat3.txt');
    });

    it.each([[0, 1], [1, 0], [1.5, 1], [-1, 1], [NaN, 1], [1e21, 1], [1, Number.MAX_SAFE_INTEGER + 1]])('rejects event=%p heat=%p', (event, heat) => {
      expect(heatFilename(event, heat)).toBeNull();
    });
  });

  describe('heatFilePath', () => {
    it.each(['../Event1-Heat1.txt', 'Event1-Heat1.txt/..', 'competition.json', 'Event1-Heat1.csv', 'Event1-Heat1_x.txt'])(
      'rejects %p',
      (name) => {
        expect(heatFilePath(name)).toBeNull();
      },
    );

    it('resolves heat files and backups inside the export directory', () => {
      expect(heatFilePath('Event1-Heat2.txt')).toBe(path.join(splashExportDir(), 'Event1-Heat2.txt'));
      expect(heatFilePath('Event1-Heat2_20261002-153045-1.txt')).not.toBeNull();
    });
  });

  describe('buildHeatFile', () => {
    it('writes LANE and TIME columns sorted by lane and distance, with CRLF line endings', () => {
      const content = buildHeatFile(lanes({
        4: { 50: 34_990, 100: 69_210 },
        3: { 100: 71_220, 50: 35_220 },
      }));
      expect(content).toBe('LANE;TIME50;TIME100\r\n3;35.22;1:11.22\r\n4;34.99;1:09.21\r\n');
    });

    it('leaves cells empty for distances a lane has not reached', () => {
      const content = buildHeatFile(lanes({
        1: { 50: 30_000, 100: 62_000 },
        2: { 50: 31_000 },
      }));
      expect(content).toBe('LANE;TIME50;TIME100\r\n1;30.00;1:02.00\r\n2;31.00;\r\n');
    });
  });

  describe('backupHeatFile', () => {
    const now = new Date(2026, 9, 2, 15, 30, 45);

    it('returns null when there is nothing to back up', () => {
      expect(backupHeatFile(path.join(tmp, 'Event1-Heat1.txt'), now)).toBeNull();
    });

    it('renames with a timestamp and never overwrites an earlier backup', () => {
      const file = path.join(tmp, 'Event1-Heat1.txt');
      fs.writeFileSync(file, 'first');
      expect(path.basename(backupHeatFile(file, now)!)).toBe('Event1-Heat1_20261002-153045.txt');
      fs.writeFileSync(file, 'second');
      expect(path.basename(backupHeatFile(file, now)!)).toBe('Event1-Heat1_20261002-153045-1.txt');
      expect(fs.existsSync(file)).toBe(false);
      expect(fs.readFileSync(path.join(tmp, 'Event1-Heat1_20261002-153045.txt'), 'utf-8')).toBe('first');
    });
  });

  describe('SplashExporter', () => {
    it('rewrites the heat file on every split', () => {
      const exporter = new SplashExporter();
      exporter.onStart(1, 2, T0);
      exporter.onSplit(3, 50, T0 + 35_220);
      expect(read('Event1-Heat2.txt')).toBe('LANE;TIME50\r\n3;35.22\r\n');
      exporter.onSplit(3, 100, T0 + 71_220);
      expect(read('Event1-Heat2.txt')).toBe('LANE;TIME50;TIME100\r\n3;35.22;1:11.22\r\n');
    });

    it('writes via a temp file and rename, leaving no temp file behind', () => {
      const rename = jest.spyOn(fs, 'renameSync');
      const exporter = new SplashExporter();
      exporter.onStart(1, 2, T0);
      exporter.onSplit(3, 50, T0 + 35_220);
      expect(rename).toHaveBeenCalledWith(
        path.join(splashExportDir(), '.Event1-Heat2.txt.tmp'),
        path.join(splashExportDir(), 'Event1-Heat2.txt'),
      );
      expect(fs.readdirSync(splashExportDir())).toEqual(['Event1-Heat2.txt']);
    });

    it('does not write without a valid start', () => {
      const exporter = new SplashExporter();
      exporter.onSplit(3, 50, T0);
      exporter.onStart(undefined, 1, T0);
      exporter.onSplit(3, 50, T0);
      exporter.onStart(1, 1, undefined);
      exporter.onSplit(3, 50, T0);
      expect(fs.existsSync(splashExportDir())).toBe(false);
    });

    it('stops recording after reset', () => {
      const exporter = new SplashExporter();
      exporter.onStart(1, 1, T0);
      exporter.onSplit(3, 50, T0 + 30_000);
      exporter.onReset();
      exporter.onSplit(3, 100, T0 + 60_000);
      expect(read('Event1-Heat1.txt')).toBe('LANE;TIME50\r\n3;30.00\r\n');
    });

    it('backs up the file of an earlier run once, on the first split of a re-swum heat', () => {
      const exporter = new SplashExporter();
      exporter.onStart(1, 1, T0);
      exporter.onSplit(3, 50, T0 + 30_000);
      exporter.onStart(1, 1, T0 + 100_000); // false start without splits: no backup
      exporter.onStart(1, 1, T0 + 200_000);
      exporter.onSplit(3, 50, T0 + 232_000);
      exporter.onSplit(3, 100, T0 + 264_000);

      const files = listHeatFiles();
      expect(files.filter((f) => f.backup)).toHaveLength(1);
      expect(read('Event1-Heat1.txt')).toBe('LANE;TIME50;TIME100\r\n3;32.00;1:04.00\r\n');
      expect(read(files.find((f) => f.backup)!.name)).toBe('LANE;TIME50\r\n3;30.00\r\n');
    });

    it('logs and swallows write errors', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('disk full'); });
      const exporter = new SplashExporter();
      exporter.onStart(1, 1, T0);
      expect(() => exporter.onSplit(3, 50, T0 + 30_000)).not.toThrow();
      expect(error).toHaveBeenCalled();
    });
  });

  describe('listHeatFiles / clearHeatFiles', () => {
    it('returns an empty list when the directory does not exist', () => {
      expect(listHeatFiles()).toEqual([]);
    });

    it('lists only heat files with event, heat and backup flag, and clears them', () => {
      const dir = splashExportDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Event12-Heat3.txt'), 'x');
      fs.writeFileSync(path.join(dir, 'Event12-Heat3_20261002-153045.txt'), 'x');
      fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');

      const files = listHeatFiles();
      expect(files.map(({ name, event, heat, backup }) => ({ name, event, heat, backup }))).toEqual(
        expect.arrayContaining([
          { name: 'Event12-Heat3.txt', event: 12, heat: 3, backup: false },
          { name: 'Event12-Heat3_20261002-153045.txt', event: 12, heat: 3, backup: true },
        ]),
      );
      expect(files).toHaveLength(2);

      expect(clearHeatFiles()).toBe(2);
      expect(fs.readdirSync(dir)).toEqual(['notes.txt']);
    });
  });
});
