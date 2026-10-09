// Live log for the competition remote: a short feed of what happens in the system
// (start, splits, ignored taps, heat changes, devices). Newest entry first.
//
// Exports:
//   initLiveLog()
//   addLogEntry(kind, text, timestamp)
//   formatLogTime(timestamp)

const MAX_ENTRIES = 100;

// Class names are written out in full so the Tailwind scanner picks them up.
const KIND_CLASSES = {
  START: 'bg-emerald-400',
  SPLIT: 'bg-aqua',
  TIMEOUT: 'bg-amber-deck',
  HEAT: 'bg-violet-300',
  DEVICE: 'bg-pool-300',
  SYSTEM: 'bg-pool-300',
};

let listElement = null;
let emptyElement = null;
let countElement = null;

function updateSummary() {
  const count = listElement ? listElement.children.length : 0;
  if (countElement) countElement.textContent = String(count);
  if (emptyElement) emptyElement.classList.toggle('hidden', count > 0);
}

/**
 * Format a timestamp as a local wall-clock time.
 * @param {number} timestamp
 * @returns {string}
 */
export function formatLogTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Add an entry at the top of the log.
 * @param {keyof typeof KIND_CLASSES} kind
 * @param {string} text
 * @param {number} [timestamp] - Defaults to now
 */
export function addLogEntry(kind, text, timestamp = Date.now()) {
  if (!listElement) return;
  const item = document.createElement('li');
  item.className = 'grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 py-2';

  const time = document.createElement('span');
  time.className = 'pt-0.5 font-mono text-xs text-pool-300';
  time.textContent = formatLogTime(timestamp);

  const body = document.createElement('span');
  body.className = 'min-w-0 text-sm leading-snug';
  const chip = document.createElement('span');
  chip.className = `log-chip ${KIND_CLASSES[kind] ?? KIND_CLASSES.SYSTEEM}`;
  chip.textContent = kind;
  const message = document.createElement('span');
  message.textContent = text;
  body.append(chip, message);

  item.append(time, body);
  listElement.prepend(item);
  while (listElement.children.length > MAX_ENTRIES) {
    listElement.lastElementChild.remove();
  }
  updateSummary();
}

/** Look up the log elements and wire the clear button. */
export function initLiveLog() {
  listElement = document.getElementById('log-list');
  emptyElement = document.getElementById('log-empty');
  countElement = document.getElementById('log-count');
  const clearButton = document.getElementById('log-clear');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (listElement) listElement.replaceChildren();
      updateSummary();
    });
  }
  updateSummary();
}
