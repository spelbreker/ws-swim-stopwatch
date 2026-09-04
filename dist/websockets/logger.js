"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStart = logStart;
exports.logReset = logReset;
exports.logSplit = logSplit;
exports.logIgnoredSplit = logIgnoredSplit;
exports.resetLoggerState = resetLoggerState;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_FILE = path_1.default.join(process.cwd(), '/logs/competition.log');
function appendLog(message) {
    try {
        console.log(message); // Log to console for real-time visibility
        fs_1.default.appendFileSync(LOG_FILE, `${message}\n`);
    }
    catch (err) {
        console.error('Failed to write to competition.log:', err);
    }
}
let lastStartTimestamp = null;
function logStart(event, heat, timestamp) {
    lastStartTimestamp = timestamp;
    const startLine = '====================================================================';
    const startMsg = `[${new Date(Number(timestamp)).toISOString()}] START - Event: ${event}, Heat: ${heat}, Timestamp: ${timestamp}`;
    appendLog(`\n${startLine}\n${startMsg}\n${startLine}`);
}
function logReset(timestamp) {
    const resetLine = '--------------------------------------------------------------------';
    const resetMsg = `[${new Date(Number(timestamp)).toISOString()}] RESET - Timestamp: ${timestamp}`;
    lastStartTimestamp = null; // Reset the last start timestamp
    appendLog(`\n${resetLine}\n${resetMsg}\n${resetLine}`);
}
function formatRaceTime(timestamp) {
    if (lastStartTimestamp === null) {
        // No start: show 00:00.xxx where xxx is the last three digits of the timestamp
        return `00:00.${String(timestamp % 1000).padStart(3, '0')}`;
    }
    const elapsed = timestamp - lastStartTimestamp;
    const minutes = String(Math.floor(elapsed / 60000)).padStart(2, '0');
    const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
    const millis = String(elapsed % 1000).padStart(3, '0');
    return `${minutes}:${seconds}.${millis}`;
}
function logSplit(lane, timestamp, elapsedMs, distance, splitNumber) {
    if (typeof timestamp === 'undefined') {
        return; // Exit early if timestamp is invalid
    }
    const elapsedStr = typeof elapsedMs === 'number' ? `, Elapsed: ${elapsedMs}ms` : '';
    const distanceStr = typeof distance === 'number' ? `, Distance: ${distance}m` : '';
    const splitStr = typeof splitNumber === 'number' ? `, Split: ${splitNumber}` : '';
    const splitMsg = `[${new Date(Number(timestamp)).toISOString()}] SPLIT - Lane: ${lane}, Time: ${formatRaceTime(timestamp)}, `
        + `Timestamp: ${timestamp}${elapsedStr}${distanceStr}${splitStr}`;
    appendLog(splitMsg);
}
function logIgnoredSplit(lane, timestamp, reason, msSinceLast) {
    const sinceStr = typeof msSinceLast === 'number' ? `, Since last: ${msSinceLast}ms` : '';
    const msg = `[${new Date(Number(timestamp)).toISOString()}] SPLIT IGNORED - Lane: ${lane}, Reason: ${reason}, `
        + `Time: ${formatRaceTime(timestamp)}, Timestamp: ${timestamp}${sinceStr}`;
    appendLog(msg);
}
function resetLoggerState() {
    lastStartTimestamp = null;
}
