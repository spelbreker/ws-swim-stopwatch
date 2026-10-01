// Connection indicator DOM helper.
// Replaces the indicator logic in main.js.
//
// Usage:
//   import { setupConnectionIndicator } from '../js/modules/connectionIndicator.js';
//   import { onSocketEvent } from './socket.js';
//   setupConnectionIndicator(onSocketEvent);
//
// Expects an element with id="connection-indicator" in the DOM.
// Toggles bg-green-500 (connected) / bg-red-500 (disconnected).

/**
 * Set up the connection indicator to react to socket open/close events.
 * @param {function} onSocketEvent - The socket event subscriber function
 */
export function setupConnectionIndicator(onSocketEvent) {
  const indicator = document.getElementById('connection-indicator');
  if (!indicator) return;

  onSocketEvent((event) => {
    if (event === 'open') {
      indicator.classList.remove('bg-red-500');
      indicator.classList.add('bg-green-500');
    } else if (event === 'close') {
      if (navigator.onLine) {
        indicator.classList.remove('bg-green-500');
        indicator.classList.add('bg-red-500');
      }
    }
  });
}
