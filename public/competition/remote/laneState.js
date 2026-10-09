// Pure lane-state helpers for the competition remote (no DOM access).
//
// The server ignores a split when a lane splits again within the cooldown, when
// the first split of a lane arrives within the cooldown after the start, and for
// every split after the finish. The remote mirrors that so a blocked lane is
// shown (and not tappable) instead of silently doing nothing.
//
// Exports:
//   blockedUntil({ finished, lastSplitTs, startTs, cooldownMs })
//   describeLane({ running, finished, splitCount, distance, place, remainingMs, cooldownMs })

/**
 * Timestamp (ms) until which a lane does not accept a split.
 * Infinity after the finish, 0 when the lane is free.
 * @param {{ finished: boolean, lastSplitTs: number|null, startTs: number|null, cooldownMs: number }} lane
 * @returns {number}
 */
export function blockedUntil({ finished, lastSplitTs, startTs, cooldownMs }) {
  if (finished) return Infinity;
  if (lastSplitTs) return lastSplitTs + cooldownMs;
  if (startTs) return startTs + cooldownMs;
  return 0;
}

/**
 * Describe how a lane row looks: state, status text, whether taps are blocked
 * and how much of the timeout is left (0-100) for the progress bar.
 * @param {Object} lane
 * @param {boolean} lane.running - A race is running
 * @param {boolean} lane.finished
 * @param {number} lane.splitCount
 * @param {number} [lane.distance]
 * @param {number} [lane.place]
 * @param {number} lane.remainingMs - Timeout left; Infinity after the finish
 * @param {number} lane.cooldownMs
 * @returns {{ state: 'ready'|'swim'|'timeout'|'finished', status: string, blocked: boolean, progress: number }}
 */
export function describeLane({
  running, finished, splitCount, distance, place, remainingMs, cooldownMs,
}) {
  if (finished) {
    return { state: 'finished', status: place ? `Finish · #${place}` : 'Finish', blocked: true, progress: 0 };
  }
  if (running && remainingMs > 0) {
    const progress = Math.max(0, Math.min(100, (remainingMs / cooldownMs) * 100));
    return {
      state: 'timeout',
      status: `Timeout ${(remainingMs / 1000).toFixed(1)}s`,
      blocked: true,
      progress,
    };
  }
  if (running) {
    const status = splitCount > 0 ? `Split ${splitCount}${distance ? ` · ${distance}m` : ''}` : 'Swimming';
    return { state: 'swim', status, blocked: false, progress: 0 };
  }
  return { state: 'ready', status: 'Ready', blocked: false, progress: 0 };
}
