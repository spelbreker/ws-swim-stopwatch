// Competition Screen — ES module entry point.
// Replaces the old screen.js that relied on window.socket, window.formatLapTime, window.TimeSync.

import { onSocketEvent } from '../js/modules/socket.js';
import { TimeSync } from '../js/modules/timeSync.js';
import { setupConnectionIndicator } from '../js/modules/connectionIndicator.js';
import { requestWakeLock } from '../js/modules/wakeLock.js';
import {
  startStopwatch,
  stopStopwatch,
  setServerTimeOffset,
} from './screen/stopwatch.js';
import {
  fetchCompetitionData,
  clearLaneInformation,
  clearSplitTimes,
  clearArrivalOrders,
  renderRanking,
  renderSplitTime,
  formatSplitTime,
} from './screen/laneDisplay.js';

let timeSync = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize shared modules
  requestWakeLock();
  setupConnectionIndicator(onSocketEvent);

  // Initialize TimeSync
  timeSync = new TimeSync({
    debugLogging: true,
    onOffsetUpdate: (offset) => {
      setServerTimeOffset(offset);
    },
  });

  // Initialize with first event and heat
  fetchCompetitionData(1, 1);

  // WebSocket message handler
  onSocketEvent((event, socket, message) => {
    if (event !== 'message') return;

    /** Start the stopwatch */
    if (message.type === 'start') {
      startStopwatch(message.timestamp);
      clearSplitTimes();
      clearArrivalOrders();
      return;
    }

    /** Stop the stopwatch */
    if (message.type === 'reset') {
      stopStopwatch();
      clearArrivalOrders();
      return;
    }

    /** Update lane information */
    if (message.type === 'split') {
      const lane = message.lane;
      if (message.timestamp) {
        const laneElement = document.getElementById(`lane-${lane}`);
        if (laneElement) {
          const splitCell = laneElement.querySelector('.split-time');
          const arrivalCell = laneElement.querySelector('.arrival-order');
          if (splitCell && arrivalCell) {
            const formattedTime = formatSplitTime(message.timestamp);
            renderSplitTime(splitCell, message.distance, formattedTime);
          }
          // Server determines placement: redraw all lanes from the ranking
          renderRanking(message.ranking);
          if (message.isFinish) {
            laneElement.classList.add('finished');
          }
          laneElement.classList.add('highlight');
          setTimeout(() => laneElement.classList.remove('highlight'), 2000);
        }
      }
      return;
    }

    /** Change event and heat information */
    if (message.type === 'event-heat' || message.type === 'select-event') {
      const eventNumberEl = document.getElementById('event-number');
      const heatNumberEl = document.getElementById('heat-number');
      if (eventNumberEl) eventNumberEl.textContent = message.event;
      if (heatNumberEl) heatNumberEl.textContent = message.heat;
      clearArrivalOrders();
      fetchCompetitionData(message.event, message.heat, message.session);
      return;
    }

    /** Clear all lane information */
    if (message.type === 'clear') {
      clearLaneInformation();
      clearArrivalOrders();
      return;
    }

    /** Update server time offset */
    if (message.type === 'pong' || message.type === 'time_sync') {
      timeSync.processTimeSync(message);
      return;
    }
  });
});
