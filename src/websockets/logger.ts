import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), '/logs/competition.log');

function appendLog(message: string) {
  try {
    console.log(message); // Log to console for real-time visibility
    fs.appendFileSync(LOG_FILE, `${message}\n`);
  } catch (err) {
     
    console.error('Failed to write to competition.log:', err);
  }
}

let lastStartTimestamp: number | null = null;

export function logStart(event: string | number, heat: string | number, timestamp: number) {
  lastStartTimestamp = timestamp;
  const startLine = '====================================================================';
   
  const startMsg = `[${new Date(Number(timestamp)).toISOString()}] START - Event: ${event}, Heat: ${heat}, Timestamp: ${timestamp}`;
  appendLog(`\n${startLine}\n${startMsg}\n${startLine}`);
}

export function logReset(timestamp: number) {
  const resetLine = '--------------------------------------------------------------------';
  const resetMsg = `[${new Date(Number(timestamp)).toISOString()}] RESET - Timestamp: ${timestamp}`;
  lastStartTimestamp = null; // Reset the last start timestamp
  appendLog(`\n${resetLine}\n${resetMsg}\n${resetLine}`);
}

function formatRaceTime(timestamp: number): string {
  if (lastStartTimestamp === null) {
    // No start: show 00:00.xxx where xxx is the last three digits of the timestamp
    return `00:00.${String(Math.floor(timestamp) % 1000).padStart(3, '0')}`;
  }
  // Timestamps may carry sub-millisecond fractions from time sync; log whole ms
  const elapsed = Math.floor(timestamp - lastStartTimestamp);
  const minutes = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
  const millis = String(elapsed % 1000).padStart(3, '0');
  return `${minutes}:${seconds}.${millis}`;
}

export function logSplit(
  lane: string | number,
  timestamp: number | undefined,
  elapsedMs?: number,
  distance?: number,
  splitNumber?: number,
) {
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

export type IgnoredSplitReason = 'cooldown' | 'after-finish';

export function logIgnoredSplit(
  lane: string | number,
  timestamp: number,
  reason: IgnoredSplitReason,
  msSinceLast?: number,
) {
  const sinceStr = typeof msSinceLast === 'number' ? `, Since last: ${msSinceLast}ms` : '';
  const msg = `[${new Date(Number(timestamp)).toISOString()}] SPLIT IGNORED - Lane: ${lane}, Reason: ${reason}, `
    + `Time: ${formatRaceTime(timestamp)}, Timestamp: ${timestamp}${sinceStr}`;
  appendLog(msg);
}

export function resetLoggerState() {
  lastStartTimestamp = null;
}
