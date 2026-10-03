import fs from 'fs';
import path from 'path';
import type { HeatRun } from './splitTracker';

/**
 * Export of heat results for Splash Meet Manager's "Generic Txt heat files"
 * timing interface: one semicolon-separated file per heat, named
 * Event{B}-Heat{C}.txt, with a LANE column and TIME{distance} columns.
 *
 * Example:
 *   LANE;TIME50;TIME100
 *   3;35.22;1:11.22
 *   4;34.99;1:09.21
 */

/** Heat file or a backup of it (Event1-Heat2_20261002-153045[-1].txt). */
const HEAT_FILE = /^Event(\d+)-Heat(\d+)(_\d{8}-\d{6}(?:-\d+)?)?\.txt$/;
/** Temp file used while writing a heat file. */
const TEMP_FILE = /^\.Event\d+-Heat\d+\.txt\.tmp$/;

/** Lanes the system knows (remote buttons and screen rows 0-9, as in Meet Manager). */
export const MIN_LANE = 0;
export const MAX_LANE = 9;

/**
 * Directory the heat files are written to (default ./exports/splashme,
 * override the base with EXPORT_DIR) so Docker can bind-mount it and it can
 * later be shared with the Meet Manager PC.
 */
export function splashExportDir(): string {
  return path.resolve(process.cwd(), process.env.EXPORT_DIR || './exports', 'splashme');
}

/**
 * Format elapsed milliseconds as a Meet Manager swim time, truncated to
 * hundredths: "35.22" below one minute, "1:11.22" from one minute.
 */
export function formatSplashTime(elapsedMs: number): string {
  const totalCs = Math.max(0, Math.floor(elapsedMs / 10));
  const cs = String(totalCs % 100).padStart(2, '0');
  const totalSec = Math.floor(totalCs / 100);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}.${cs}`
    : `${seconds}.${cs}`;
}

// Safe integers only: 1e21 is an integer but stringifies as "1e+21"
function isPositiveInt(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isExportLane(lane: number): boolean {
  return Number.isSafeInteger(lane) && lane >= MIN_LANE && lane <= MAX_LANE;
}

/**
 * Meet Manager filename for a heat, or null when event/heat are not positive
 * integers. Event numbers are unique within a Splash meet, so the session
 * prefix is not needed.
 */
export function heatFilename(event: number, heat: number): string | null {
  if (!isPositiveInt(event) || !isPositiveInt(heat)) return null;
  return `Event${event}-Heat${heat}.txt`;
}

/** Parse a heat file name; null for anything else. */
export function parseHeatFilename(name: string): { event: number; heat: number; backup: boolean } | null {
  const match = HEAT_FILE.exec(name);
  if (!match) return null;
  return { event: Number(match[1]), heat: Number(match[2]), backup: match[3] !== undefined };
}

/** Elapsed times per lane, keyed by split distance in meters. */
export type LaneTimes = Map<number, Map<number, number>>;

/**
 * Build the file content. Columns are the union of all recorded distances, so
 * a lane that has not reached a distance yet gets an empty cell there.
 */
export function buildHeatFile(lanes: LaneTimes): string {
  const distances = new Set<number>();
  lanes.forEach((times) => times.forEach((_, distance) => distances.add(distance)));
  const columns = Array.from(distances).sort((a, b) => a - b);

  const lines = [['LANE', ...columns.map((d) => `TIME${d}`)].join(';')];
  Array.from(lanes.entries()).sort(([a], [b]) => a - b).forEach(([lane, times]) => {
    const cells = columns.map((d) => {
      const elapsed = times.get(d);
      return elapsed === undefined ? '' : formatSplashTime(elapsed);
    });
    lines.push([String(lane), ...cells].join(';'));
  });
  // Meet Manager runs on Windows
  return `${lines.join('\r\n')}\r\n`;
}

/** Elapsed times of the run's exportable lanes (integer lanes 0-9). */
export function runLaneTimes(run: HeatRun): LaneTimes {
  const lanes: LaneTimes = new Map();
  run.lanes.forEach((splits, lane) => {
    if (!isExportLane(lane)) return;
    const times = new Map<number, number>();
    splits.forEach((timestamp, distance) => times.set(distance, timestamp - run.startTime));
    lanes.set(lane, times);
  });
  return lanes;
}

function backupStamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
    + `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/**
 * Rename an existing heat file to Event1-Heat1_YYYYMMDD-HHMMSS.txt (server
 * local time, set TZ in Docker) so a re-swum heat does not silently overwrite
 * earlier results.
 */
export function backupHeatFile(filePath: string, now = new Date()): string | null {
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath);
  const base = path.join(path.dirname(filePath), `${path.basename(filePath, ext)}_${backupStamp(now)}`);
  let target = `${base}${ext}`;
  for (let i = 1; fs.existsSync(target); i++) target = `${base}-${i}${ext}`;
  fs.renameSync(filePath, target);
  return target;
}

/**
 * Writes the running heat of the SplitTracker to its heat file. The tracker
 * owns the heat lifecycle; the exporter only remembers which run it wrote last,
 * so the first write of a new run backs up the file of an earlier run.
 */
export class SplashExporter {
  private writtenRunId: number | null = null;

  write(run: HeatRun | null) {
    if (!run) return;
    const filename = heatFilename(run.event, run.heat);
    const lanes = runLaneTimes(run);
    if (!filename || lanes.size === 0) return;

    const dir = splashExportDir();
    const filePath = path.join(dir, filename);
    const tmpPath = path.join(dir, `.${filename}.tmp`);
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (this.writtenRunId !== run.runId) {
        const backup = backupHeatFile(filePath);
        if (backup) console.log(`[SplashExport] Backed up previous ${filename} to ${path.basename(backup)}`);
        this.writtenRunId = run.runId;
      }
      // Write to a temp file and rename, so a reader (Meet Manager over a share)
      // never sees a half-written file. The dot prefix keeps it out of listings.
      fs.writeFileSync(tmpPath, buildHeatFile(lanes));
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.error(`[SplashExport] Failed to write ${filename}:`, err);
      fs.rmSync(tmpPath, { force: true });
    }
  }
}

export interface HeatFileInfo {
  name: string;
  event: number;
  heat: number;
  /** True for a backed-up earlier run of the heat. */
  backup: boolean;
  size: number;
  modified: string;
}

function readExportDir(): string[] {
  const dir = splashExportDir();
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

/** Heat files in the export directory, most recently modified first. */
export function listHeatFiles(): HeatFileInfo[] {
  const dir = splashExportDir();
  const files: HeatFileInfo[] = [];
  readExportDir().forEach((name) => {
    const parsed = parseHeatFilename(name);
    if (!parsed) return;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(path.join(dir, name));
    } catch (err) {
      // Renamed (backup) or deleted between readdir and stat
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    files.push({ name, ...parsed, size: stat.size, modified: stat.mtime.toISOString() });
  });
  return files.sort((a, b) => b.modified.localeCompare(a.modified));
}

/** Delete all heat files, backups and leftover temp files; returns the number of heat files removed. */
export function clearHeatFiles(): number {
  const dir = splashExportDir();
  let deleted = 0;
  readExportDir().forEach((name) => {
    const isHeatFile = parseHeatFilename(name) !== null;
    if (!isHeatFile && !TEMP_FILE.test(name)) return;
    // force: a file renamed or removed meanwhile is not an error
    fs.rmSync(path.join(dir, name), { force: true });
    if (isHeatFile) deleted += 1;
  });
  return deleted;
}
