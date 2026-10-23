import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SplashExporter,
  backupHeatFile,
  buildHeatFile,
  clearHeatFiles,
  formatSplashTime,
  heatFilename,
  listHeatFiles,
  parseHeatFilename,
  runLaneTimes,
  splashExportDir,
  LaneTimes,
} from '../../src/modules/splashExport';
import type { HeatRun } from '../../src/modules/splitTracker';

const T0 = 1_718_000_000_000;

function lanes(entries: Record<number, Record<number, number>>): LaneTimes {
  return new Map(Object.entries(entries).map(([lane, times]) => [
    Number(lane),
    new Map(Object.entries(times).map(([d, ms]) => [Number(d), ms])),
  ]));
}

/** A tracker run; splits are elapsed ms per lane and distance, offset from T0. */
function run(splits: Record<number, Record<number, number>>, opts: Partial<HeatRun> = {}): HeatRun {
  const startTime = opts.startTime ?? T0;
  const laneMap = new Map(Object.entries(splits).map(([lane, times]) => [
    Number(lane),
    new Map(Object.entries(times).map(([d, ms]) => [Number(d), startTime + ms])),
  ]));
  return { event: 1, heat: 2, startTime, runId: 1, lanes: laneMap, ...opts };
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

  describe('parseHeatFilename', () => {
    it.each(['../Event1-Heat1.txt', 'Event1-Heat1.txt/..', 'competition.json', 'Event1-Heat1.csv', 'Event1-Heat1_x.txt', '.Event1-Heat1.txt.tmp'])(
      'rejects %p',
      (name) => {
        expect(parseHeatFilename(name)).toBeNull();
      },
    );

    it('parses heat files and backups', () => {
      expect(parseHeatFilename('Event12-Heat3.txt')).toEqual({ event: 12, heat: 3, backup: false });
      expect(parseHeatFilename('Event12-Heat3_20261002-153045-1.txt')).toEqual({ event: 12, heat: 3, backup: true });
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

  describe('runLaneTimes', () => {
    it('converts split timestamps to elapsed times from the start', () => {
      expect(runLaneTimes(run({ 3: { 50: 35_220, 100: 71_220 } }))).toEqual(new Map([[3, new Map([[50, 35_220], [100, 71_220]])]]));
    });

    it('keeps only integer lanes 0-9', () => {
      const lanes = runLaneTimes(run({ 0: { 50: 1 }, 9: { 50: 1 }, 10: { 50: 1 }, [-1]: { 50: 1 }, 1.5: { 50: 1 } }));
      expect(Array.from(lanes.keys()).sort()).toEqual([0, 9]);
    });
  });

  describe('SplashExporter', () => {
    it('rewrites the heat file on every write', () => {
      const exporter = new SplashExporter();
      exporter.write(run({ 3: { 50: 35_220 } }));
      expect(read('Event1-Heat2.txt')).toBe('LANE;TIME50\r\n3;35.22\r\n');
      exporter.write(run({ 3: { 50: 35_220, 100: 71_220 } }));
      expect(read('Event1-Heat2.txt')).toBe('LANE;TIME50;TIME100\r\n3;35.22;1:11.22\r\n');
    });

    it('writes via a temp file and rename, leaving no temp file behind', () => {
      const rename = jest.spyOn(fs, 'renameSync');
      new SplashExporter().write(run({ 3: { 50: 35_220 } }));
      expect(rename).toHaveBeenCalledWith(
        path.join(splashExportDir(), '.Event1-Heat2.txt.tmp'),
        path.join(splashExportDir(), 'Event1-Heat2.txt'),
      );
      expect(fs.readdirSync(splashExportDir())).toEqual(['Event1-Heat2.txt']);
    });

    it.each([
      ['no run', null],
      ['an invalid event', run({ 3: { 50: 1 } }, { event: 1e21 })],
      ['only lanes outside 0-9', run({ 12: { 50: 30_000 } })],
    ])('writes nothing for %s', (_label, heatRun) => {
      new SplashExporter().write(heatRun);
      expect(fs.existsSync(splashExportDir())).toBe(false);
    });

    it('leaves lanes outside 0-9 out of the file', () => {
      new SplashExporter().write(run({ 3: { 50: 30_000 }, 12: { 50: 31_000 } }));
      expect(read('Event1-Heat2.txt')).toBe('LANE;TIME50\r\n3;30.00\r\n');
    });

    it('backs up the file of an earlier run once, on the first write of a new run', () => {
      const exporter = new SplashExporter();
      exporter.write(run({ 3: { 50: 30_000 } }, { runId: 1 }));
      exporter.write(run({ 3: { 50: 32_000 } }, { runId: 3 }));
      exporter.write(run({ 3: { 50: 32_000, 100: 64_000 } }, { runId: 3 }));

      const files = listHeatFiles();
      expect(files.filter((f) => f.backup)).toHaveLength(1);
      expect(read('Event1-Heat2.txt')).toBe('LANE;TIME50;TIME100\r\n3;32.00;1:04.00\r\n');
      expect(read(files.find((f) => f.backup)!.name)).toBe('LANE;TIME50\r\n3;30.00\r\n');
    });

    it('retries the backup on the next write when it failed', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const exporter = new SplashExporter();
      exporter.write(run({ 3: { 50: 30_000 } }, { runId: 1 }));
      const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('EBUSY'); });
      exporter.write(run({ 3: { 50: 32_000 } }, { runId: 2 }));
      rename.mockRestore();
      exporter.write(run({ 3: { 50: 32_000 } }, { runId: 2 }));
      expect(listHeatFiles().filter((f) => f.backup)).toHaveLength(1);
    });

    it('logs write errors and removes the temp file', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disk full'); });
      expect(() => new SplashExporter().write(run({ 3: { 50: 30_000 } }))).not.toThrow();
      expect(error).toHaveBeenCalled();
      expect(fs.readdirSync(splashExportDir())).toEqual([]);
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

    it('also removes leftover temp files', () => {
      const dir = splashExportDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '.Event1-Heat1.txt.tmp'), 'x');
      expect(listHeatFiles()).toEqual([]);
      expect(clearHeatFiles()).toBe(0);
      expect(fs.readdirSync(dir)).toEqual([]);
    });

    it('skips a file that disappears between readdir and stat', () => {
      const dir = splashExportDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Event1-Heat1.txt'), 'x');
      fs.writeFileSync(path.join(dir, 'Event1-Heat2.txt'), 'x');
      const realStat = fs.statSync;
      jest.spyOn(fs, 'statSync').mockImplementation(((p: fs.PathLike) => {
        if (String(p).endsWith('Event1-Heat1.txt')) {
          throw Object.assign(new Error('gone'), { code: 'ENOENT' });
        }
        return realStat(p);
      }) as typeof fs.statSync);
      expect(listHeatFiles().map((f) => f.name)).toEqual(['Event1-Heat2.txt']);
    });

    it('still fails on other stat errors', () => {
      const dir = splashExportDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Event1-Heat1.txt'), 'x');
      jest.spyOn(fs, 'statSync').mockImplementation(() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); });
      expect(() => listHeatFiles()).toThrow('denied');
    });
  });
});
