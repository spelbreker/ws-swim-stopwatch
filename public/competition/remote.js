// Competition Remote — ES module entry point.
// Replaces the old remote.js that relied on window.socket, window.formatLapTime, window.TimeSync.
//
// Imports shared modules and delegates to remote/* submodules.

import { send, onSocketEvent } from '../js/modules/socket.js';
import { TimeSync } from '../js/modules/timeSync.js';
import { pad } from '../js/modules/format.js';
import { setupConnectionIndicator } from '../js/modules/connectionIndicator.js';
import { requestWakeLock } from '../js/modules/wakeLock.js';
import {
  initLaneButtons,
  setRoster,
  setLocked,
  startRace,
  resetRace,
  applySplit,
  clearLaneInformation,
  cancelAllHighlightTimers,
  loadSplitCooldown,
} from './remote/laneButtons.js';
import {
  initEventHeat,
  fillSelectOptions,
  sendEventAndHeat,
  updateEventHeatInfoBar,
  onHeatDisplayed,
} from './remote/eventHeat.js';
import { loadHeatViews } from './remote/upcoming.js';
import { initLiveLog, refreshLiveLog } from './remote/liveLog.js';
import { initKeysMode } from './remote/keysMode.js';
import { initTabs } from './remote/tabs.js';
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
  });
}

function getServerTimeOffset() {
  return serverTimeOffset;
}

document.addEventListener('DOMContentLoaded', () => {
  const stopwatchElement = document.getElementById('stopwatch');
  const startButton = document.getElementById('start-button');
  const clearScreenButton = document.getElementById('clear-screen');

  // Initialize shared modules
  requestWakeLock();
  setupConnectionIndicator(onSocketEvent);
  loadSplitCooldown();
  initTabs();
  initLiveLog();
  initKeysMode({ onChange: (mode) => setLocked(mode === 'locked') });
  onHeatDisplayed((event, heat, session) => {
    loadHeatViews(event, heat, session, { onRoster: setRoster });
  });

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
  initLaneButtons({
    send,
    getServerTimeOffset,
    // An ignored split is logged by the server but not broadcast: pick it up from the log.
    onSplitSent: () => setTimeout(refreshLiveLog, 300),
  });
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
  }).then(async () => {
    const session = getCurrentSession();
    await Promise.all([
      fillSelectOptions(eventSelect, 25, session),
      fillSelectOptions(heatSelect, 25, session),
    ]);
    updateEventHeatInfoBar(eventSelect.value || 1, heatSelect.value || 1, session);
  });

  const controlElements = [
    eventSelect,
    heatSelect,
    document.getElementById('increment-event'),
    document.getElementById('increment-heat'),
    document.getElementById('decrement-event'),
    document.getElementById('decrement-heat'),
  ];
  const liveBadge = document.getElementById('live-badge');

  function updateStartButtonUI(isRunning) {
    if (liveBadge) liveBadge.classList.toggle('hidden', !isRunning);
    if (!startButton) return;
    if (isRunning) {
      startButton.textContent = 'Stop and reset';
      startButton.classList.remove('bg-emerald-400', 'text-emerald-950', 'hover:bg-emerald-300');
      startButton.classList.add('bg-red-400', 'text-red-950', 'hover:bg-red-300');
      disableControls(true, controlElements);
    } else {
      startButton.textContent = 'Start stopwatch';
      startButton.classList.remove('bg-red-400', 'text-red-950', 'hover:bg-red-300');
      startButton.classList.add('bg-emerald-400', 'text-emerald-950', 'hover:bg-emerald-300');
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
    startRace(startTime);
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
    resetRace();
    if (sendSocket) {
      send({ type: 'reset' });
    }
    updateStartButtonUI(false);
  }

  let selectionId = 0;
  // Show a selection made elsewhere (another remote or the starter): session,
  // event and heat selects, the heat card and the heat-dependent views.
  async function syncSelection(event, heat, session) {
    const id = ++selectionId;
    const sessionNumber = session ? Number(session) : getCurrentSession();
    if (sessionNumber && sessionNumber !== getCurrentSession()) {
      // The event list belongs to the session: load it before selecting the event.
      setCurrentSession(sessionNumber);
      await fillSelectOptions(eventSelect, 25, sessionNumber);
      if (id !== selectionId) return;
    }
    if (eventSelect && event !== undefined) eventSelect.value = event;
    if (heatSelect && heat !== undefined) heatSelect.value = heat;
    updateEventHeatInfoBar(event ?? eventSelect?.value, heat ?? heatSelect?.value, sessionNumber);
  }

  function isOtherSelection(message) {
    return String(message.event) !== eventSelect?.value
      || String(message.heat) !== heatSelect?.value
      || (Boolean(message.session) && Number(message.session) !== getCurrentSession());
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
  let pingInterval = null;
  function sendPing() {
    pingStartTime = Date.now();
    send({ type: 'ping', time: pingStartTime });
  }

  function stopPingSync() {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  // WebSocket event handler
  onSocketEvent((event, socket, message) => {
    if (event === 'open') {
      stopPingSync();

      // Start initial fast sync sequence
      let pingCount = 0;
      const maxInitialPings = 5;
      const initialPingInterval = 500;
      const normalPingInterval = 5000;

      pingInterval = setInterval(() => {
        sendPing();
        pingCount++;
        if (pingCount >= maxInitialPings) {
          stopPingSync();
          pingInterval = setInterval(sendPing, normalPingInterval);
          console.log('[Remote] Switched to normal ping interval after initial sync');
        }
      }, initialPingInterval);

      return;
    }

    if (event === 'close') {
      stopPingSync();
      return;
    }

    if (event !== 'message') return;

    /** Start the stopwatch */
    if (message.type === 'start') {
      startTime = message.timestamp;
      if (stopwatchInterval) clearInterval(stopwatchInterval);
      stopwatchInterval = setInterval(updateStopwatch, 10);
      startRace(message.timestamp);
      loadSplitCooldown();
      updateStartButtonUI(true);
      refreshLiveLog();
      // A starter can start another heat than the one shown: the server switches to it too.
      if (message.event !== undefined && message.heat !== undefined && isOtherSelection(message)) {
        syncSelection(message.event, message.heat, message.session);
      }
      return;
    }

    /** Stop the stopwatch */
    if (message.type === 'reset') {
      resetStopwatch(false);
      cancelAllHighlightTimers();
      refreshLiveLog();
      return;
    }

    /** Update lane information */
    if (message.type === 'split') {
      applySplit(message, startTime);
      refreshLiveLog();
      return;
    }

    /** Change event and heat information */
    if (message.type === 'event-heat') {
      cancelAllHighlightTimers();
      syncSelection(message.event, message.heat, message.session);
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
