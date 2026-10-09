// Live log for the competition remote. It shows the server's competition log
// (logs/competition.log), so everything the external clocks and other devices
// did is visible here, including splits the server ignored. Newest entry first.
//
// Exports:
//   initLiveLog()
//   refreshLiveLog()
//   parseLogLine(line)
//   formatLogTime(isoTimestamp)

const MAX_ENTRIES = 100;
// The log holds a few separator lines per start/reset next to the entries.
const TAIL_LINES = 300;
const POLL_MS = 3000;

// Class names are written out in full so the Tailwind scanner picks them up.
const KIND_CLASSES = {
  START: 'bg-emerald-400',
  SPLIT: 'bg-aqua',
  IGNORED: 'bg-amber-deck',
  RESET: 'bg-pool-300',
};

const IGNORED_REASONS = {
  cooldown: 'within the cooldown of the previous split',
  'start-cooldown': 'within the cooldown after the start',
  'after-finish': 'after the finish',
  'not-running': 'because no race is running',
};

let listElement = null;
let emptyElement = null;
let countElement = null;
let pollTimer = null;
let lastSnapshot = null;
let refreshing = false;
let refreshQueued = false;

function field(line, name) {
  const match = line.match(new RegExp(`${name}: ([^,]+)`));
  return match ? match[1].trim() : null;
}

/**
 * Format an ISO timestamp from the log as a local wall-clock time.
 * @param {string} isoTimestamp
 * @returns {string}
 */
export function formatLogTime(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Turn one competition.log line into a log entry, or null for separators and
 * lines that are not an event.
 * @param {string} line
 * @returns {{ time: string, kind: string, text: string }|null}
 */
export function parseLogLine(line) {
  const match = line.match(/^\[([^\]]+)\] (START|RESET|SPLIT IGNORED|SPLIT)\b(.*)$/);
  if (!match) return null;
  const [, iso, type, rest] = match;
  if (Number.isNaN(new Date(iso).getTime())) return null;
  const time = formatLogTime(iso);

  if (type === 'START') {
    return { time, kind: 'START', text: `Event ${field(rest, 'Event')}, heat ${field(rest, 'Heat')}` };
  }
  if (type === 'RESET') {
    return { time, kind: 'RESET', text: 'Stopwatch stopped and reset' };
  }

  const lane = field(rest, 'Lane');
  const raceTime = field(rest, 'Time');
  if (type === 'SPLIT IGNORED') {
    const reason = field(rest, 'Reason');
    return {
      time,
      kind: 'IGNORED',
      text: `Lane ${lane} · split ignored ${IGNORED_REASONS[reason] ?? reason}`,
    };
  }
  const parts = [`Lane ${lane}`, raceTime];
  const distance = field(rest, 'Distance');
  const splitNumber = field(rest, 'Split');
  if (distance) parts.push(distance);
  if (splitNumber) parts.push(`split ${splitNumber}`);
  return { time, kind: 'SPLIT', text: parts.join(' · ') };
}

function render(entries) {
  if (!listElement) return;
  const items = entries.map((entry) => {
    const item = document.createElement('li');
    item.className = 'grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 py-2';

    const time = document.createElement('span');
    time.className = 'pt-0.5 font-mono text-xs text-pool-300';
    time.textContent = entry.time;

    const body = document.createElement('span');
    body.className = 'min-w-0 text-sm leading-snug';
    const chip = document.createElement('span');
    chip.className = `log-chip ${KIND_CLASSES[entry.kind]}`;
    chip.textContent = entry.kind;
    const message = document.createElement('span');
    message.textContent = entry.text;
    body.append(chip, message);

    item.append(time, body);
    return item;
  });
  listElement.replaceChildren(...items);
  if (countElement) countElement.textContent = String(entries.length);
  if (emptyElement) emptyElement.classList.toggle('hidden', entries.length > 0);
}

/**
 * Fetch the tail of the server log and show it. A call during a fetch runs once
 * more after it, because that fetch may have read the log before the new line.
 */
export async function refreshLiveLog() {
  if (!listElement) return;
  if (refreshing) {
    refreshQueued = true;
    return;
  }
  refreshing = true;
  try {
    const res = await fetch(`/logs/competition.log?tail=${TAIL_LINES}`, { cache: 'no-store' });
    // A missing log file just means nothing has happened yet; other errors keep what is shown.
    if (!res.ok && res.status !== 404) return;
    const text = res.ok ? await res.text() : '';
    if (text === lastSnapshot) return;
    lastSnapshot = text;
    const entries = text
      .split('\n')
      .map(parseLogLine)
      .filter(Boolean)
      .reverse()
      .slice(0, MAX_ENTRIES);
    render(entries);
  } catch {
    // Network hiccup: keep what is shown and try again on the next poll.
  } finally {
    refreshing = false;
    if (refreshQueued) {
      refreshQueued = false;
      refreshLiveLog();
    }
  }
}

/** Look up the log elements and start polling the server log. */
export function initLiveLog() {
  listElement = document.getElementById('log-list');
  emptyElement = document.getElementById('log-empty');
  countElement = document.getElementById('log-count');
  refreshLiveLog();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!document.hidden) refreshLiveLog();
  }, POLL_MS);
}
