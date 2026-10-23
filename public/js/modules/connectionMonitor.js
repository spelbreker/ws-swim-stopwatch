// Connection health monitor for pages that ping the server (the remote).
//
// A WebSocket can look open while the network is gone (wifi dropped without a
// close event), so besides open/close this also watches for silence: when no
// message arrives for `timeoutMs` the connection counts as lost.
//
// Usage:
//   const monitor = createConnectionMonitor({ onChange: (online) => ... });
//   onSocketEvent((event) => monitor.handle(event));
//
// onChange fires only when the state flips; it is not called before the first
// open or close, so a page that is still connecting shows no false alarm.

const DEFAULT_TIMEOUT_MS = 12_000; // two missed 5 s pings
const DEFAULT_CHECK_MS = 1000;

/**
 * @param {Object} opts
 * @param {function(boolean): void} opts.onChange - Called with true (online) or false (lost)
 * @param {number} [opts.timeoutMs] - Silence after which the connection counts as lost
 * @param {number} [opts.checkMs] - How often the silence check runs
 */
export function createConnectionMonitor({ onChange, timeoutMs = DEFAULT_TIMEOUT_MS, checkMs = DEFAULT_CHECK_MS }) {
  let online = null;
  let socketOpen = false;
  let lastAlive = 0;
  let timer = null;

  function setOnline(next) {
    if (next === online) return;
    online = next;
    onChange(online);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function checkSilence() {
    if (Date.now() - lastAlive > timeoutMs) setOnline(false);
  }

  function handle(event) {
    if (event === 'open') {
      socketOpen = true;
      lastAlive = Date.now();
      stopTimer();
      timer = setInterval(checkSilence, checkMs);
      setOnline(true);
    } else if (event === 'close') {
      socketOpen = false;
      stopTimer();
      setOnline(false);
    } else if (event === 'message' && socketOpen) {
      lastAlive = Date.now();
      setOnline(true);
    }
  }

  return { handle, isOnline: () => online === true };
}
