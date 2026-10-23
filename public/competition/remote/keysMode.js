// Keypad mode for the competition remote: the 0-9 keys are not always needed.
//   hidden - keypad not shown; tapping a lane row still sends a split
//   shown  - keypad visible
//   locked - keypad hidden/disabled and lane rows ignore taps (no accidental splits)
// The choice is remembered per device in localStorage.
//
// Exports:
//   KEYS_MODES
//   initKeysMode({ onChange })

export const KEYS_MODES = ['hidden', 'shown', 'locked'];
const STORAGE_KEY = 'remote.keysMode';

function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return KEYS_MODES.includes(stored) ? stored : 'hidden';
  } catch {
    return 'hidden';
  }
}

function storeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (private mode): the mode just is not remembered.
  }
}

/**
 * Initialize the keypad mode switch.
 * @param {Object} opts
 * @param {function} opts.onChange - Called with (mode) on init and every change
 * @returns {{ getMode: function, setMode: function }}
 */
export function initKeysMode({ onChange }) {
  const group = document.getElementById('keys-mode');
  const keypad = document.getElementById('keypad');
  const notice = document.getElementById('lane-lock-notice');
  let mode = readStoredMode();

  function apply() {
    document.querySelectorAll('[data-keys-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-keys-mode') === mode));
    });
    if (keypad) keypad.classList.toggle('hidden', mode !== 'shown');
    if (notice) {
      notice.classList.toggle('hidden', mode !== 'locked');
      notice.classList.toggle('flex', mode === 'locked');
    }
    if (onChange) onChange(mode);
  }

  function setMode(next) {
    if (!KEYS_MODES.includes(next)) return;
    mode = next;
    storeMode(mode);
    apply();
  }

  if (group) {
    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-keys-mode]');
      if (button) setMode(button.getAttribute('data-keys-mode'));
    });
  }

  apply();
  return { getMode: () => mode, setMode };
}
