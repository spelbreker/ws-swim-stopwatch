// Competition Remote — ES module entry point.
// Replaces the old remote.js that relied on window.socket, window.formatLapTime, window.TimeSync.
//
// Imports shared modules and delegates to remote/* submodules.

import { send, onSocketEvent } from '../js/modules/socket.js';
import { TimeSync } from '../js/modules/timeSync.js';
import { formatLapTime } from '../js/modules/format.js';
import { setupConnectionIndicator } from '../js/modules/connectionIndicator.js';
import { requestWakeLock } from '../js/modules/wakeLock.js';
import {
  initLaneButtons,
  updateLaneInfo,
  resetSplitTimes,
  clearLaneInformation,
  highlightLaneButton,
  cancelAllHighlightTimers,
  loadSplitCooldown,
} from './remote/laneButtons.js';
import {
  initEventHeat,
  fillSelectOptions,
  sendEventAndHeat,
  updateEventHeatInfoBar,
  getEventSelect,
  getHeatSelect,
} from './remote/eventHeat.js';
import {
  initSessionSelector,
  getCurrentSession,
  setCurrentSession,
} from './remote/sessionSelector.js';

// State
let startTime = null;
let stopwatchInterval = null;
let serverTimeOffset = 0;
let timeSync = null;

function pad(n) {
  return n.toString().padStart(2, '0');
}

function updateStopwatch() {
  const stopwatchElement = document.getElementById('stopwatch');
  if (!stopwatchElement) return;
  if (!startTime) {
    stopwatchElement.textContent = '00:00:00';
    return;
  }
  const now = Date.now() + serverTimeOffset;
  const elapsed = now - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const milliseconds = Math.floor((elapsed % 1000) / 10);
  stopwatchElement.textContent = `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
}

function disableControls(disable, elements) {
  elements.forEach((element) => {
    if (!element) return;
    element.disabled = disable;
    const classAction = disable ? 'add' : 'remove';
    element.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
  });
}

function getServerTimeOffset() {
  return serverTimeOffset;
}

function getStartTime() {
  return startTime;
}

document.addEventListener('DOMContentLoaded', () => {
  const stopwatchElement = document.getElementById('stopwatch');
  const startButton = document.getElementById('start-button');
  const clearScreenButton = document.getElementById('clear-screen');

  // Initialize shared modules
  requestWakeLock();
  setupConnectionIndicator(onSocketEvent);
  loadSplitCooldown();

  // Initialize TimeSync
  timeSync = new TimeSync({
    debugLogging: true,
    onPingUpdate: (rtt) => {
      const pingDisplay = document.getElementById('ping-display');
      if (pingDisplay) {
        pingDisplay.textContent = Number.isFinite(rtt) && rtt >= 0 ? `${rtt} ms` : '';
      }
    },
    onOffsetUpdate: (offset) => {
      serverTimeOffset = offset;
    },
  });

  // Initialize submodules
  const { eventSelect, heatSelect, incrementEvent, incrementHeat } = initEventHeat({
    send,
    getCurrentSession,
  });
  initLaneButtons({ send, getStartTime, getServerTimeOffset });
  initSessionSelector({
    onSessionChanged: (sessionNumber) => {
      // Refresh event list for the new session
      fillSelectOptions(eventSelect, 25, sessionNumber);
      setTimeout(() => {
        const firstEvent = eventSelect.options[0]?.value || 1;
        eventSelect.value = firstEvent;
        heatSelect.value = 1;
        sendEventAndHeat(firstEvent, 1, send, sessionNumber);
        updateEventHeatInfoBar(firstEvent, 1, sessionNumber);
      }, 100);
    },
  });

  const controlElements = [eventSelect, heatSelect, document.getElementById('increment-event'), document.getElementById('increment-heat')];

  function updateStartButtonUI(isRunning) {
    if (!startButton) return;
    if (isRunning) {
      startButton.textContent = 'Stop stopwatch';
      startButton.classList.remove('bg-green-600', 'hover:bg-green-700');
      startButton.classList.add('bg-red-600', 'hover:bg-red-700');
      disableControls(true, controlElements);
    } else {
      startButton.textContent = 'Start stopwatch';
      startButton.classList.remove('bg-red-600', 'hover:bg-red-700');
      startButton.classList.add('bg-green-600', 'hover:bg-green-700');
      disableControls(false, controlElements);
    }
  }

  function startStopwatch(sendSocket = true, startTimeOverride = null) {
    if (stopwatchInterval) return;
    if (startTimeOverride) {
      startTime = startTimeOverride;
    } else {
      startTime = Date.now() + serverTimeOffset;
    }
    stopwatchInterval = setInterval(updateStopwatch, 10);
    resetSplitTimes();
    if (sendSocket) {
      send({ type: 'start', timestamp: startTime, heat: heatSelect.value, event: eventSelect.value });
    }
    updateStartButtonUI(true);
  }

  function resetStopwatch(sendSocket = true) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    startTime = null;
    if (stopwatchElement) stopwatchElement.textContent = '00:00:00';
    if (sendSocket) {
      send({ type: 'reset' });
    }
    updateStartButtonUI(false);
  }

  // Button event listeners
  if (clearScreenButton) {
    clearScreenButton.addEventListener('click', () => {
      send({ type: 'clear' });
    });
  }

  if (startButton) {
    startButton.addEventListener('click', () => {
      if (stopwatchInterval) {
        resetStopwatch();
      } else {
        startStopwatch();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      const button = document.querySelector(`.lane-button[data-lane="${e.key}"]`);
      if (button) button.click();
    } else if (e.key === 'Enter') {
      if (stopwatchInterval) {
        resetStopwatch();
      } else {
        startStopwatch();
      }
    } else if (e.key === '+' && !stopwatchInterval) {
      incrementHeat();
    } else if (e.key === '*' && !stopwatchInterval) {
      incrementEvent();
    }
  });

  // Ping logic
  let pingStartTime = 0;
  function sendPing() {
    pingStartTime = Date.now();
    send({ type: 'ping', time: pingStartTime });
  }

  // WebSocket event handler
  onSocketEvent((event, socket, message) => {
    if (event === 'open') {
      fillSelectOptions(eventSelect, 25, getCurrentSession());
      fillSelectOptions(heatSelect, 25, getCurrentSession());

      // Start initial fast sync sequence
      let pingCount = 0;
      const maxInitialPings = 5;
      const initialPingInterval = 500;
      const normalPingInterval = 5000;

      const initialSync = setInterval(() => {
        sendPing();
        pingCount++;
        if (pingCount >= maxInitialPings) {
          clearInterval(initialSync);
          setInterval(sendPing, normalPingInterval);
          console.log('[Remote] Switched to normal ping interval after initial sync');
        }
      }, initialPingInterval);

      updateEventHeatInfoBar(eventSelect.value || 1, heatSelect.value || 1, getCurrentSession());
      return;
    }

    if (event !== 'message') return;

    /** Start the stopwatch */
    if (message.type === 'start') {
      startTime = message.timestamp;
      if (stopwatchInterval) clearInterval(stopwatchInterval);
      stopwatchInterval = setInterval(updateStopwatch, 10);
      for (let i = 0; i <= 9; i++) {
        updateLaneInfo(i, '---:---:---');
      }
      loadSplitCooldown();
      updateStartButtonUI(true);
      return;
    }

    /** Stop the stopwatch */
    if (message.type === 'reset') {
      resetStopwatch(false);
      cancelAllHighlightTimers();
      return;
    }

    /** Update lane information */
    if (message.type === 'split') {
      const lane = message.lane;
      if (message.timestamp) {
        updateLaneInfo(lane, formatLapTime(message.timestamp, startTime || 0), message.distance);
      }
      const button = document.querySelector(`.lane-button[data-lane="${lane}"]`);
      if (button) highlightLaneButton(button);
      return;
    }

    /** Change event and heat information */
    if (message.type === 'event-heat') {
      if (eventSelect) eventSelect.value = message.event;
      if (heatSelect) heatSelect.value = message.heat;
      resetSplitTimes();
      cancelAllHighlightTimers();
      updateEventHeatInfoBar(message.event, message.heat, message.session ?? getCurrentSession());
      return;
    }

    /** Clear all lane information */
    if (message.type === 'clear') {
      clearLaneInformation();
      return;
    }

    /** Handle ping from other clients */
    if (message.type === 'ping') {
      const clientPingTime = Date.now();
      send({ type: 'pong', client_ping_time: clientPingTime });
      return;
    }

    /** Update server time offset */
    if (message.type === 'pong' || message.type === 'time_sync') {
      timeSync.processTimeSync(message);
      return;
    }
  });
});
