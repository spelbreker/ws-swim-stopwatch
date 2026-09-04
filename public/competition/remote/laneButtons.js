// Lane button logic for the competition remote.
// Handles lane button clicks, split sending, cooldown highlight timers,
// and lane time display updates.
//
// Exports:
//   initLaneButtons({ send, serverTimeOffset, formatLapTime, startTime })
//   updateLaneInfo(lane, time, distance)
//   resetSplitTimes()
//   clearLaneInformation()
//   highlightLaneButton(button)
//   loadSplitCooldown()

let splitCooldownMs = 12000;
const laneHighlightTimers = new Map();

/**
 * Update the lane time display.
 * @param {number} lane
 * @param {string} time - Formatted time string
 * @param {number} [distance] - Optional distance in meters
 */
export function updateLaneInfo(lane, time, distance) {
  const timeSpan = document.querySelector(`.lane-time[data-lane="${lane}"]`);
  if (timeSpan) {
    timeSpan.textContent = distance ? `${distance}m ${time}` : time;
  }
}

/** Reset all lane time displays to 00:00:00. */
export function resetSplitTimes() {
  document.querySelectorAll('.lane-time').forEach((span) => {
    span.textContent = '00:00:00';
  });
}

/** Clear all lane information: times, highlight timers, button colors. */
export function clearLaneInformation() {
  document.querySelectorAll('.lane-button').forEach((button) => {
    const lane = button.getAttribute('data-lane');
    updateLaneInfo(lane, '00:00:00');
    clearTimeout(laneHighlightTimers.get(lane));
    laneHighlightTimers.delete(lane);
    button.classList.remove('bg-green-500');
    button.classList.add('bg-blue-500');
  });
}

/**
 * Highlight a lane button green for the configured cooldown duration.
 * An ignored split does not restart the timer.
 * @param {HTMLElement} button
 */
export function highlightLaneButton(button) {
  const lane = button.getAttribute('data-lane');
  clearTimeout(laneHighlightTimers.get(lane));
  button.classList.add('bg-green-500');
  button.classList.remove('bg-blue-500');
  laneHighlightTimers.set(
    lane,
    setTimeout(() => {
      button.classList.remove('bg-green-500');
      button.classList.add('bg-blue-500');
      laneHighlightTimers.delete(lane);
    }, splitCooldownMs),
  );
}

/** Cancel all pending highlight timers (used on reset/clear/heat change). */
export function cancelAllHighlightTimers() {
  laneHighlightTimers.forEach((timer) => clearTimeout(timer));
  laneHighlightTimers.clear();
}

/**
 * Fetch the split cooldown setting from the server.
 * @returns {Promise<void>}
 */
export async function loadSplitCooldown() {
  try {
    const res = await fetch('/settings');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = await res.json();
    if (Number.isFinite(settings.splitCooldownSec)) {
      splitCooldownMs = settings.splitCooldownSec * 1000;
    }
  } catch {
    console.warn('Could not load split cooldown, using default');
  }
}

/**
 * Initialize lane button click handlers.
 * @param {Object} opts
 * @param {function} opts.send - WebSocket send function
 * @param {function} opts.getStartTime - Returns current start time (or null)
 * @param {function} opts.getServerTimeOffset - Returns current server time offset
 */
export function initLaneButtons({ send, getStartTime, getServerTimeOffset }) {
  const laneButtons = document.querySelectorAll('.lane-button');
  laneButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const lane = button.getAttribute('data-lane');
      const lapTimestamp = Date.now() + getServerTimeOffset();
      send({ type: 'split', lane, timestamp: lapTimestamp });
    });
  });
}
