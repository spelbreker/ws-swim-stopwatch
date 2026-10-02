import fs from 'fs';
import path from 'path';

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

const HEAT_FILE_PATTERN = /^Event\d+-Heat\d+(_\d{8}-\d{6}(-\d+)?)?\.txt$/;
const HEAT_FILE_PARTS = /^Event(\d+)-Heat(\d+)(_.+)?\.txt$/;

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

/**
 * Meet Manager filename for a heat, or null when event/heat are not positive
 * integers. Event numbers are unique within a Splash meet, so the session
 * prefix is not needed.
 */
export function heatFilename(event: number, heat: number): string | null {
  if (!isPositiveInt(event) || !isPositiveInt(heat)) return null;
  return `Event${event}-Heat${heat}.txt`;
}

export function isHeatFilename(name: string): boolean {
  return HEAT_FILE_PATTERN.test(name);
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
  Array.from(lanes.keys()).sort((a, b) => a - b).forEach((lane) => {
    const times = lanes.get(lane)!;
    const cells = columns.map((d) => (times.has(d) ? formatSplashTime(times.get(d)!) : ''));
    lines.push([String(lane), ...cells].join(';'));
  });
  // Meet Manager runs on Windows
  return `${lines.join('\r\n')}\r\n`;
}

function backupStamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
    + `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/**
 * Rename an existing heat file to Event1-Heat1_YYYYMMDD-HHMMSS.txt so a
 * re-swum heat does not silently overwrite earlier results.
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

interface HeatRun {
  filename: string;
  startTime: number;
  lanes: LaneTimes;
  /** True until the first write of this run, which backs up an older file. */
  needsBackup: boolean;
}

/**
 * Records accepted splits of the running heat and rewrites its heat file on
 * every split, so the file is always current even when no reset follows.
 */
export class SplashExporter {
  private run: HeatRun | null = null;

  onStart(event: number | undefined, heat: number | undefined, startTime: number | undefined) {
    const filename = event !== undefined && heat !== undefined ? heatFilename(event, heat) : null;
    this.run = filename && startTime !== undefined
      ? { filename, startTime, lanes: new Map(), needsBackup: true }
      : null;
  }

  onSplit(lane: number, distance: number, timestamp: number) {
    if (!this.run) return;
    const times = this.run.lanes.get(lane) ?? new Map<number, number>();
    times.set(distance, timestamp - this.run.startTime);
    this.run.lanes.set(lane, times);
    this.write();
  }

  onReset() {
    this.run = null;
  }

  private write() {
    const run = this.run!;
    try {
      const dir = splashExportDir();
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, run.filename);
      if (run.needsBackup) {
        const backup = backupHeatFile(filePath);
        if (backup) console.log(`[SplashExport] Backed up previous ${run.filename} to ${path.basename(backup)}`);
        run.needsBackup = false;
      }
      // Write to a temp file and rename, so a reader (Meet Manager over a share)
      // never sees a half-written file. The dot prefix keeps it out of listings.
      const tmpPath = path.join(dir, `.${run.filename}.tmp`);
      fs.writeFileSync(tmpPath, buildHeatFile(run.lanes));
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.error(`[SplashExport] Failed to write ${run.filename}:`, err);
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

/** Heat files in the export directory, most recently modified first. */
export function listHeatFiles(): HeatFileInfo[] {
  const dir = splashExportDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(isHeatFilename)
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      const [, event, heat, suffix] = HEAT_FILE_PARTS.exec(name)!;
      return {
        name,
        event: Number(event),
        heat: Number(heat),
        backup: suffix !== undefined,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

/** Absolute path of a heat file, or null for names that are not heat files. */
export function heatFilePath(name: string): string | null {
  return isHeatFilename(name) ? path.join(splashExportDir(), name) : null;
}

/** Delete all heat files (and backups); returns the number removed. */
export function clearHeatFiles(): number {
  const files = listHeatFiles();
  files.forEach(({ name }) => fs.unlinkSync(path.join(splashExportDir(), name)));
  return files.length;
}
