"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplashExporter = void 0;
exports.splashExportDir = splashExportDir;
exports.formatSplashTime = formatSplashTime;
exports.heatFilename = heatFilename;
exports.isHeatFilename = isHeatFilename;
exports.buildHeatFile = buildHeatFile;
exports.backupHeatFile = backupHeatFile;
exports.listHeatFiles = listHeatFiles;
exports.heatFilePath = heatFilePath;
exports.clearHeatFiles = clearHeatFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
function splashExportDir() {
    return path_1.default.resolve(process.cwd(), process.env.EXPORT_DIR || './exports', 'splashme');
}
/**
 * Format elapsed milliseconds as a Meet Manager swim time, truncated to
 * hundredths: "35.22" below one minute, "1:11.22" from one minute.
 */
function formatSplashTime(elapsedMs) {
    const totalCs = Math.max(0, Math.floor(elapsedMs / 10));
    const cs = String(totalCs % 100).padStart(2, '0');
    const totalSec = Math.floor(totalCs / 100);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return minutes > 0
        ? `${minutes}:${String(seconds).padStart(2, '0')}.${cs}`
        : `${seconds}.${cs}`;
}
function isPositiveInt(value) {
    return Number.isInteger(value) && value > 0;
}
/**
 * Meet Manager filename for a heat, or null when event/heat are not positive
 * integers. Event numbers are unique within a Splash meet, so the session
 * prefix is not needed.
 */
function heatFilename(event, heat) {
    if (!isPositiveInt(event) || !isPositiveInt(heat))
        return null;
    return `Event${event}-Heat${heat}.txt`;
}
function isHeatFilename(name) {
    return HEAT_FILE_PATTERN.test(name);
}
/**
 * Build the file content. Columns are the union of all recorded distances, so
 * a lane that has not reached a distance yet gets an empty cell there.
 */
function buildHeatFile(lanes) {
    const distances = new Set();
    lanes.forEach((times) => times.forEach((_, distance) => distances.add(distance)));
    const columns = Array.from(distances).sort((a, b) => a - b);
    const lines = [['LANE', ...columns.map((d) => `TIME${d}`)].join(';')];
    Array.from(lanes.keys()).sort((a, b) => a - b).forEach((lane) => {
        const times = lanes.get(lane);
        const cells = columns.map((d) => (times.has(d) ? formatSplashTime(times.get(d)) : ''));
        lines.push([String(lane), ...cells].join(';'));
    });
    // Meet Manager runs on Windows
    return `${lines.join('\r\n')}\r\n`;
}
function backupStamp(now) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
        + `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}
/**
 * Rename an existing heat file to Event1-Heat1_YYYYMMDD-HHMMSS.txt so a
 * re-swum heat does not silently overwrite earlier results.
 */
function backupHeatFile(filePath, now = new Date()) {
    if (!fs_1.default.existsSync(filePath))
        return null;
    const ext = path_1.default.extname(filePath);
    const base = path_1.default.join(path_1.default.dirname(filePath), `${path_1.default.basename(filePath, ext)}_${backupStamp(now)}`);
    let target = `${base}${ext}`;
    for (let i = 1; fs_1.default.existsSync(target); i++)
        target = `${base}-${i}${ext}`;
    fs_1.default.renameSync(filePath, target);
    return target;
}
/**
 * Records accepted splits of the running heat and rewrites its heat file on
 * every split, so the file is always current even when no reset follows.
 */
class SplashExporter {
    constructor() {
        this.run = null;
    }
    onStart(event, heat, startTime) {
        const filename = event !== undefined && heat !== undefined ? heatFilename(event, heat) : null;
        this.run = filename && startTime !== undefined
            ? { filename, startTime, lanes: new Map(), needsBackup: true }
            : null;
    }
    onSplit(lane, distance, timestamp) {
        if (!this.run)
            return;
        const times = this.run.lanes.get(lane) ?? new Map();
        times.set(distance, timestamp - this.run.startTime);
        this.run.lanes.set(lane, times);
        this.write();
    }
    onReset() {
        this.run = null;
    }
    write() {
        const run = this.run;
        try {
            const dir = splashExportDir();
            fs_1.default.mkdirSync(dir, { recursive: true });
            const filePath = path_1.default.join(dir, run.filename);
            if (run.needsBackup) {
                const backup = backupHeatFile(filePath);
                if (backup)
                    console.log(`[SplashExport] Backed up previous ${run.filename} to ${path_1.default.basename(backup)}`);
                run.needsBackup = false;
            }
            fs_1.default.writeFileSync(filePath, buildHeatFile(run.lanes));
        }
        catch (err) {
            console.error(`[SplashExport] Failed to write ${run.filename}:`, err);
        }
    }
}
exports.SplashExporter = SplashExporter;
/** Heat files in the export directory, most recently modified first. */
function listHeatFiles() {
    const dir = splashExportDir();
    if (!fs_1.default.existsSync(dir))
        return [];
    return fs_1.default.readdirSync(dir)
        .filter(isHeatFilename)
        .map((name) => {
        const stat = fs_1.default.statSync(path_1.default.join(dir, name));
        const [, event, heat, suffix] = HEAT_FILE_PARTS.exec(name);
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
function heatFilePath(name) {
    return isHeatFilename(name) ? path_1.default.join(splashExportDir(), name) : null;
}
/** Delete all heat files (and backups); returns the number removed. */
function clearHeatFiles() {
    const files = listHeatFiles();
    files.forEach(({ name }) => fs_1.default.unlinkSync(path_1.default.join(splashExportDir(), name)));
    return files.length;
}
