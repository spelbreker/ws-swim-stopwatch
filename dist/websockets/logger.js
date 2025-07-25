"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStart = logStart;
exports.logStop = logStop;
exports.logLap = logLap;
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
function logStop(timestamp) {
    const stopLine = '--------------------------------------------------------------------';
    const stopMsg = `[${new Date(Number(timestamp)).toISOString()}] STOP - Timestamp: ${timestamp}`;
    lastStartTimestamp = null; // Reset the last start timestamp
    appendLog(`\n${stopLine}\n${stopMsg}\n${stopLine}`);
}
function logLap(lane, timestamp) {
    const lastStart = lastStartTimestamp;
    if (typeof timestamp === 'undefined') {
        return; // Exit early if timestamp is invalid
    }
    if (lastStart === null) {
        // No start: show 00:00.xxx where xxx is the last three digits of the timestamp
        const millis = String(timestamp % 1000).padStart(3, '0');
        const formattedTime = `00:00.${millis}`;
        const lapMsg = `[${new Date(Number(timestamp)).toISOString()}] LAP - Lane: ${lane}, Time: ${formattedTime}, `
            + `Timestamp: ${timestamp}`;
        appendLog(lapMsg);
        return;
    }
    const elapsed = timestamp - lastStart;
    const minutes = String(Math.floor((elapsed ?? 0) / 60000)).padStart(2, '0');
    const seconds = String(Math.floor(((elapsed ?? 0) % 60000) / 1000)).padStart(2, '0');
    const millis = String((elapsed ?? 0) % 1000).padStart(3, '0');
    const formattedTime = `${minutes}:${seconds}.${millis}`;
    const lapMsg = `[${new Date(Number(timestamp)).toISOString()}] LAP - Lane: ${lane}, Time: ${formattedTime}, `
        + `Timestamp: ${timestamp}`;
    appendLog(lapMsg);
}
function resetLoggerState() {
    lastStartTimestamp = null;
}
