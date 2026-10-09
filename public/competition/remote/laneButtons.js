// Lane logic for the competition remote.
// Owns the per-lane state (swimmer, last split, timeout) and renders the lane
// rows and keypad keys. Rows and keys both send a split when tapped, unless the
// lane is blocked (timeout after a split or the start, finished) or the keys are
// locked. Lanes without a registered swimmer are not blocked.
//
// Exports:
//   initLaneButtons({ send, getServerTimeOffset, onBlocked })
//   loadSplitCooldown()
//   setRoster(entries | null)
//   setLocked(locked)
//   startRace(timestamp)
//   resetRace()
//   applySplit(message, startTime)
//   resetSplitTimes()
//   clearLaneInformation()
//   cancelAllHighlightTimers()

import { formatLapTime } from '../../js/modules/format.js';
import { blockedUntil, describeLane } from './laneState.js';

const LANES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const TICK_MS = 100;
const NO_TIME = '--:--:--';

let splitCooldownMs = 12000;
let running = false;
let startTs = null;
let rosterLoaded = false;
let locked = false;
let tickTimer = null;
let sendSplit = () => {};
let getOffset = () => 0;
let onBlockedTap = () => {};

/** @type {Map<number, object>} */
const swimmers = new Map();
/** @type {Map<number, object>} */
const splits = new Map();
/** @type {Map<number, object>} */
const elements = new Map();

function now() {
  return Date.now() + getOffset();
}

function getSplit(lane) {
  return splits.get(lane) ?? {
    count: 0, lastTs: null, time: NO_TIME, distance: undefined, finished: false, place: undefined,
  };
}

function viewFor(lane) {
  const swimmer = swimmers.get(lane);
  const split = getSplit(lane);
  // A lane without a registered swimmer stays usable: unregistered swimmers sometimes swim there.
  const unassigned = rosterLoaded && !swimmer;
  const until = blockedUntil({
    finished: split.finished,
    lastSplitTs: split.lastTs,
    startTs: running ? startTs : null,
    cooldownMs: splitCooldownMs,
  });
  const remainingMs = running || split.finished ? until - now() : 0;
  const description = describeLane({
    running,
    finished: split.finished,
    splitCount: split.count,
    distance: split.distance,
    place: split.place,
    remainingMs,
    cooldownMs: splitCooldownMs,
  });
  return {
    ...description, swimmer, split, remainingMs, unassigned,
  };
}

function renderLane(lane) {
  const els = elements.get(lane);
  if (!els) return null;
  const view = viewFor(lane);
  const { row } = els;
  row.dataset.state = view.state;
  row.dataset.locked = String(locked);
  row.dataset.unassigned = String(view.unassigned);
  row.setAttribute('aria-disabled', String(view.blocked || locked));
  row.setAttribute('aria-label', `Baan ${lane}${view.swimmer ? `, ${view.swimmer.name}` : ''}, ${view.status}`);
  if (els.name) {
    els.name.textContent = view.unassigned ? 'Niet ingedeeld' : (view.swimmer?.name || `Baan ${lane}`);
  }
  if (els.club) els.club.textContent = view.swimmer?.club || '';
  if (els.time) els.time.textContent = view.split.time;
  if (els.status) els.status.textContent = view.status;
  if (els.progress) els.progress.style.width = view.state === 'timeout' ? `${view.progress}%` : '0%';
  els.keys.forEach((key) => {
    key.disabled = view.blocked || locked;
  });
  return view;
}

function renderAll() {
  let needsTick = false;
  LANES.forEach((lane) => {
    const view = renderLane(lane);
    if (view?.state === 'timeout') needsTick = true;
  });
  if (needsTick && !tickTimer) {
    tickTimer = setInterval(renderAll, TICK_MS);
  } else if (!needsTick && tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function trySplit(lane) {
  if (locked) return;
  const view = viewFor(lane);
  if (view.blocked) {
    onBlockedTap(lane, view);
    return;
  }
  sendSplit({ type: 'split', lane, timestamp: now() });
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
 * Initialize the lane rows and keypad keys.
 * @param {Object} opts
 * @param {function} opts.send - WebSocket send function
 * @param {function} opts.getServerTimeOffset - Returns current server time offset
 * @param {function} [opts.onBlocked] - Called with (lane, view) when a tap hits a blocked lane
 */
export function initLaneButtons({ send, getServerTimeOffset, onBlocked }) {
  sendSplit = send;
  getOffset = getServerTimeOffset;
  onBlockedTap = onBlocked ?? (() => {});
  elements.clear();
  document.querySelectorAll('.lane-row').forEach((row) => {
    const lane = Number(row.getAttribute('data-lane'));
    elements.set(lane, {
      row,
      name: row.querySelector('.lane-name'),
      club: row.querySelector('.lane-club'),
      time: row.querySelector('.lane-time'),
      status: row.querySelector('.lane-status'),
      progress: row.querySelector('.lane-progress'),
      keys: [],
    });
    row.addEventListener('click', () => trySplit(lane));
  });
  document.querySelectorAll('.lane-button').forEach((key) => {
    const lane = Number(key.getAttribute('data-lane'));
    elements.get(lane)?.keys.push(key);
    key.addEventListener('click', () => trySplit(lane));
  });
  renderAll();
}

/**
 * Show the swimmers of the selected heat. Pass null (no competition, fetch
 * failed) to treat every lane as usable.
 * @param {Array<{lane: number, name: string, club: string}>|null} entries
 */
export function setRoster(entries) {
  swimmers.clear();
  rosterLoaded = Array.isArray(entries) && entries.length > 0;
  if (rosterLoaded) entries.forEach((entry) => swimmers.set(entry.lane, entry));
  renderAll();
}

/** @param {boolean} value - Keys locked: taps do nothing */
export function setLocked(value) {
  locked = value;
  renderAll();
}

/** @param {number} timestamp - Start time in server time */
export function startRace(timestamp) {
  running = true;
  startTs = timestamp;
  splits.clear();
  renderAll();
}

/** Stop: forget the race, splits and all timeouts. */
export function resetRace() {
  running = false;
  startTs = null;
  splits.clear();
  renderAll();
}

/**
 * Record an accepted split broadcast by the server.
 * @param {Object} message - The `split` message
 * @param {number|null} startTime - Race start time, used for the formatted time
 * @returns {{ lane: number, name: string, time: string, splitNumber: number, isFinish: boolean }|null}
 */
export function applySplit(message, startTime) {
  const lane = Number(message.lane);
  if (!Number.isInteger(lane) || lane < 0 || lane > 9) return null;
  const previous = getSplit(lane);
  let time = message.timestamp ? formatLapTime(message.timestamp, startTime || 0) : NO_TIME;
  if (time === '---:---:---' && typeof message.elapsed_ms === 'number') {
    time = formatLapTime(message.elapsed_ms + 1, 1);
  }
  const splitNumber = typeof message.splitNumber === 'number' ? message.splitNumber : previous.count + 1;
  splits.set(lane, {
    count: splitNumber,
    lastTs: typeof message.timestamp === 'number' ? message.timestamp : now(),
    time,
    distance: message.distance,
    finished: message.isFinish === true,
    place: previous.place,
  });
  if (Array.isArray(message.ranking)) {
    message.ranking.forEach((entry) => {
      const split = splits.get(entry.lane);
      if (split) split.place = entry.place;
    });
  }
  renderAll();
  return {
    lane,
    name: swimmers.get(lane)?.name ?? '',
    time,
    splitNumber,
    isFinish: message.isFinish === true,
  };
}

/** Reset all lane time displays and timeouts. */
export function resetSplitTimes() {
  splits.clear();
  renderAll();
}

/** Clear all lane information: times and timeouts (the roster stays). */
export function clearLaneInformation() {
  splits.clear();
  renderAll();
}

/** Stop the timeout countdown and clear every lane timeout (reset/clear/heat change). */
export function cancelAllHighlightTimers() {
  splits.clear();
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  renderAll();
}
