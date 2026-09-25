// Time formatting helpers.
// Replaces window.formatLapTime from main.js.

/**
 * Pad a number to 2 digits with leading zeros.
 * @param {number} n
 * @returns {string}
 */
export function pad(n) {
  return n.toString().padStart(2, '0');
}

/**
 * Format a timestamp as mm:ss:cc relative to a base (start) time.
 * @param {number} ts - Timestamp in ms since epoch
 * @param {number} base - Base timestamp (start time), defaults to 0
 * @returns {string} Formatted as "mm:ss:cc" or "---:---:---" if invalid
 */
export function formatLapTime(ts, base = 0) {
  const elapsed = ts - base;
  if (elapsed < 0 || base === 0) return '---:---:---';
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const milliseconds = Math.floor((elapsed % 1000) / 10);
  return `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
}
