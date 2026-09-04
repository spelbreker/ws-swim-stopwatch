// Stopwatch display logic for the competition screen.
//
// Exports:
//   startStopwatch(timestamp)
//   stopStopwatch()
//   getStartTime()

import { pad } from '../../js/modules/format.js';

let startTime = null;
let stopwatchInterval = null;
let serverTimeOffset = 0;

/**
 * Set the server time offset (from TimeSync).
 * @param {number} offset
 */
export function setServerTimeOffset(offset) {
  serverTimeOffset = offset;
}

function updateStopwatch() {
  const stopwatchElement = document.getElementById('stopwatch');
  if (!stopwatchElement) return;
  if (!startTime) {
    stopwatchElement.textContent = '00:00:00';
    return;
  }
  const now = Date.now() + serverTimeOffset;
  const elapsed = now - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const milliseconds = Math.floor((elapsed % 1000) / 10);
  stopwatchElement.textContent = `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
}

export function startStopwatch(timestamp) {
  startTime = timestamp;
  if (stopwatchInterval) clearInterval(stopwatchInterval);
  stopwatchInterval = setInterval(updateStopwatch, 10);
}

export function stopStopwatch() {
  clearInterval(stopwatchInterval);
  stopwatchInterval = null;
  startTime = null;
  const stopwatchElement = document.getElementById('stopwatch');
  if (stopwatchElement) stopwatchElement.textContent = '00:00:00';
}

export function getStartTime() {
  return startTime;
}
