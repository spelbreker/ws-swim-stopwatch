// Screen wake lock helper.
// Replaces the wake lock logic in main.js.
//
// Usage:
//   import { requestWakeLock } from '../js/modules/wakeLock.js';
//   requestWakeLock(); // acquires and re-acquires on visibility change

let wakeLock = null;

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch (err) {
    console.error('Failed to acquire wake lock:', err);
  }
}

// Re-acquire on visibility change (wake lock is released when tab is hidden)
if ('wakeLock' in navigator) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wakeLock) {
      requestWakeLock();
    }
  });
}
