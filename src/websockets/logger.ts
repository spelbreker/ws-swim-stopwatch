import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), '/logs/competition.log');

function appendLog(message: string) {
  try {
    console.log(message); // Log to console for real-time visibility
    fs.appendFileSync(LOG_FILE, `${message}\n`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write to competition.log:', err);
  }
}

let lastStartTimestamp: number | null = null;

export function logStart(event: string | number, heat: string | number, timestamp: number) {
  lastStartTimestamp = timestamp;
  const startLine = '====================================================================';
  // eslint-disable-next-line max-len
  const startMsg = `[${new Date(Number(timestamp)).toISOString()}] START - Event: ${event}, Heat: ${heat}, Timestamp: ${timestamp}`;
  appendLog(`\n${startLine}\n${startMsg}\n${startLine}`);
}

export function logStop(timestamp: number) {
  const stopLine = '--------------------------------------------------------------------';
  const stopMsg = `[${new Date(Number(timestamp)).toISOString()}] STOP - Timestamp: ${timestamp}`;
  lastStartTimestamp = null; // Reset the last start timestamp
  appendLog(`\n${stopLine}\n${stopMsg}\n${stopLine}`);
}

export function logLap(lane: string | number, timestamp: number | undefined) {
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

export function resetLoggerState() {
  lastStartTimestamp = null;
}
