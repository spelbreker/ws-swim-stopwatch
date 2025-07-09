
// ------------------------------------------------------------------
// Meet/Session Selector State and Dialog Logic (now using .number, not index)
// ------------------------------------------------------------------
let selectedMeetNumber = null;
let selectedSessionNumber = null;
let meetsData = [];

document.addEventListener('DOMContentLoaded', function () {
  // Dialog elements
  const optionsBtn = document.getElementById('options-btn');
  const dialog = document.getElementById('meet-session-dialog');
  const meetSelect = document.getElementById('meet-select');
  const sessionSelect = document.getElementById('session-select');
  const dialogConfirm = document.getElementById('dialog-confirm');
  const dialogCancel = document.getElementById('dialog-cancel');
  const dialogError = document.getElementById('dialog-error');

  // Feature-detect <dialog>
  if (dialog && typeof dialog.showModal !== 'function') {
    dialog.showModal = function () { dialog.style.display = 'block'; };
    dialog.close = function () { dialog.style.display = 'none'; };
  }

  // Open dialog handler
  optionsBtn?.addEventListener('click', async () => {
    dialogError.classList.add('hidden');
    dialogError.textContent = '';
    try {
      await fetchAndPopulateMeets();
      dialog.showModal();
      meetSelect.focus();
    } catch {
      dialogError.textContent = 'Failed to load meets/sessions.';
      dialogError.classList.remove('hidden');
    }
  });

  // Cancel button handler
  dialogCancel?.addEventListener('click', () => { dialog.close(); });


  // Confirm button handler (now using .number)
  dialogConfirm?.addEventListener('click', (e) => {
    e.preventDefault();
    selectedMeetNumber = Number(meetSelect.value);
    selectedSessionNumber = Number(sessionSelect.value);
    dialog.close();
    sendMeetSessionSelection();
  });


  // Meet select change: update sessions, events, and heats
  meetSelect?.addEventListener('change', () => {
    populateSessions(Number(meetSelect.value));
    // After sessions are populated, update events and heats for the new meet/session
    // Use first session by default
    const newSessionNumber = sessionSelect.options[0]?.value;
    selectedMeetNumber = Number(meetSelect.value);
    selectedSessionNumber = Number(newSessionNumber);
    window.updateEventAndHeatSelects();
  });

  // Session select change: update events and heats
  sessionSelect?.addEventListener('change', () => {
    selectedSessionNumber = Number(sessionSelect.value);
    window.updateEventAndHeatSelects();
  });
  /**
   * Fetches events and heats for the current meet/session and updates the dropdowns.
   */
  window.updateEventAndHeatSelects = async function updateEventAndHeatSelects() {
    // Update event-select
    const eventSelect = document.getElementById('event-select');
    const heatSelect = document.getElementById('heat-select');
    if (!eventSelect || !heatSelect) return;
    try {
      const meet = selectedMeetNumber;
      const session = selectedSessionNumber;
      // Fetch events for this meet/session
      const res = await fetch(`/competition/event?meet=${meet}&session=${session}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const events = await res.json();
      eventSelect.innerHTML = '';
      events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.number;
        option.textContent = event.number;
        eventSelect.appendChild(option);
      });
      // Select first event by default
      eventSelect.value = events[0]?.number ?? '';
      // Now update heats for the first event
      await window.updateHeatSelectForEvent(events[0]?.number);
    } catch {
      eventSelect.innerHTML = '';
      heatSelect.innerHTML = '';
    }
  }

  /**
   * Fetches heats for a given event and updates the heat-select dropdown.
   */
  window.updateHeatSelectForEvent = async function updateHeatSelectForEvent(eventNumber) {
    const heatSelect = document.getElementById('heat-select');
    if (!heatSelect || !eventNumber) return;
    try {
      const meet = selectedMeetNumber;
      const session = selectedSessionNumber;
      const res = await fetch(`/competition/event/${eventNumber}?meet=${meet}&session=${session}`);
      if (!res.ok) throw new Error('Failed to fetch event data');
      const eventData = await res.json();
      heatSelect.innerHTML = '';
      (eventData.heats || []).forEach(heat => {
        const option = document.createElement('option');
        option.value = heat.number;
        option.textContent = heat.number;
        heatSelect.appendChild(option);
      });
      // Select first heat by default
      heatSelect.value = eventData.heats?.[0]?.number ?? '';
    } catch {
      heatSelect.innerHTML = '';
    }
  }


  /**
   * Fetches meets/sessions from API and populates dropdowns (using .number).
   */
  async function fetchAndPopulateMeets() {
    const res = await fetch('/competition/meets');
    if (!res.ok) throw new Error('API error');
    meetsData = await res.json();
    // Populate meets
    meetSelect.innerHTML = '';
    meetsData.forEach((meet) => {
      const opt = document.createElement('option');
      opt.value = meet.meetNumber;
      opt.textContent = meet.name + (meet.city ? ` (${meet.city})` : '');
      meetSelect.appendChild(opt);
    });
    // Default: select first meet if none selected
    if (selectedMeetNumber === null && meetsData.length > 0) {
      selectedMeetNumber = meetsData[0].meetNumber;
    }
    meetSelect.value = selectedMeetNumber;
    populateSessions(selectedMeetNumber);
    sessionSelect.value = selectedSessionNumber ?? sessionSelect.options[0]?.value;
  }


  /**
   * Populates session dropdown for a given meet number.
   */
  function populateSessions(meetNumber) {
    const meet = meetsData.find(m => m.meetNumber === meetNumber);
    sessionSelect.innerHTML = '';
    if (!meet) return;
    meet.sessions.forEach((session) => {
      const opt = document.createElement('option');
      opt.value = session.sessionNumber;
      // Show date and start time if available
      opt.textContent = `${session.date}${session.daytime ? ' ' + session.daytime : ''} (${session.eventCount} events)`;
      sessionSelect.appendChild(opt);
    });
    // Default: select first session if none selected
    if (selectedSessionNumber === null && meet.sessions.length > 0) {
      selectedSessionNumber = meet.sessions[0].sessionNumber;
    }
    sessionSelect.value = selectedSessionNumber;
  }


  /**
   * Sends the selected meet/session to the server (WebSocket),
   * and updates UI state as needed. Now sends .number, not index.
   */
  function sendMeetSessionSelection() {
    window.socket.send(JSON.stringify({
      type: 'select-meet-session',
      meetNumber: selectedMeetNumber,
      sessionNumber: selectedSessionNumber
    }));
    // Optionally, reload event/heat selectors here if needed
  }

  // Accessibility: close dialog on Escape
  dialog?.addEventListener('cancel', (e) => { e.preventDefault(); dialog.close(); });

  // If only one meet/session, skip dialog and set defaults (by number)
  fetch('/competition/meets').then(res => res.json()).then(data => {
    meetsData = data;
    if (meetsData.length === 1 && meetsData[0].sessions.length === 1) {
      selectedMeetNumber = meetsData[0].number;
      selectedSessionNumber = meetsData[0].sessions[0].number;
    }
  });
});
// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let startTime;
let eventSelect;
let heatSelect;
// Global variable for ping
let pingStartTime;
let serverTimeOffset = 0;
// Time synchronization instance
let timeSync;

// ------------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------------
function pad(number) {
    return number.toString().padStart(2, '0');
}

function updateLaneInfo(lane, time) {
    const timeSpan = document.querySelector(`.lane-time[data-lane="${lane}"]`);
    if (timeSpan) {
        timeSpan.textContent = time;
    }
}

// Update resetSplitTimes to use lane mapping
function resetSplitTimes() {
    document.querySelectorAll('.lane-time').forEach(span => {
        span.textContent = '00:00:00';
    });
}

function clearLaneInformation() {
    document.querySelectorAll('.lane-button').forEach(button => {
        const lane = button.getAttribute('data-lane');
        updateLaneInfo(lane, '00:00:00');
        button.classList.remove('bg-green-500');
        button.classList.add('bg-blue-500');
    });
}

function fillSelectOptions(selectElement, maxValue) {
    // Overwrite: fetch event list and populate select with event numbers
    if (!selectElement) return;
    if (selectElement.id === 'event-select') {
        // Always include meet/session, fallback to first if not set
        let meet = selectedMeetNumber;
        let session = selectedSessionNumber;
        if (!meet || !session) {
            if (meetsData.length > 0) {
                meet = meetsData[0].meetNumber;
                session = meetsData[0].sessions[0].sessionNumber;
            }
        }
        fetch(`/competition/event?meet=${meet}&session=${session}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch event list');
                return res.json();
            })
            .then(events => {
                selectElement.innerHTML = '';
                events.forEach(event => {
                    const option = document.createElement('option');
                    option.value = event.number;
                    option.textContent = event.number;
                    selectElement.appendChild(option);
                });
            })
            .catch(() => {
                // fallback: fill with 1..maxValue if fetch fails
                selectElement.innerHTML = '';
                for (let i = 1; i <= maxValue; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    selectElement.appendChild(option);
                }
            });
    } else {
        // fallback for heat-select
        selectElement.innerHTML = '';
        for (let i = 1; i <= maxValue; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            selectElement.appendChild(option);
        }
    }
}

function highlightLaneButton(button) {
    button.classList.add('bg-green-500');
    button.classList.remove('bg-blue-500');
    setTimeout(() => {
        button.classList.remove('bg-green-500');
        button.classList.add('bg-blue-500');
    }, 10000);
}

// Function to send a ping message over WebSocket
function sendPing() {
    pingStartTime = Date.now();
    window.socket.send(JSON.stringify({ type: 'ping', time: pingStartTime }));
}

// ------------------------------------------------------------------
// Stopwatch control functions
// ------------------------------------------------------------------
function updateStopwatch(startTime, stopwatchElement) {
    if (!startTime || !stopwatchElement) {
        if (stopwatchElement) stopwatchElement.textContent = '00:00:00';
        return;
    }
    const now = Date.now() + serverTimeOffset;
    const elapsedTime = now - startTime;
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    const milliseconds = Math.floor((elapsedTime % 1000) / 10);
    stopwatchElement.textContent =
        `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
}

function disableControls(disable, elements) {
    elements.forEach(element => {
        element.disabled = disable;
        const classAction = disable ? 'add' : 'remove';
        element.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
    });
}

// ------------------------------------------------------------------
// Event and heat control functions
// ------------------------------------------------------------------
function incrementEvent() {
    // Only increment if not at the last event option
    const options = eventSelect.options;
    const currentIndex = eventSelect.selectedIndex;
    if (currentIndex < options.length - 1) {
        eventSelect.selectedIndex = currentIndex + 1;
        heatSelect.value = 1;
        sendEventAndHeat(eventSelect.value, 1);
        updateEventHeatInfoBar(eventSelect.value, 1);
    }
}

function incrementHeat() {
    let currentHeat = parseInt(heatSelect.value);
    if (currentHeat < 20) {
        heatSelect.value = currentHeat + 1;
        sendEventAndHeat(parseInt(eventSelect.value), currentHeat + 1);
        updateEventHeatInfoBar(eventSelect.value, currentHeat + 1);
    }
}

function sendEventAndHeat(event, heat) {
    window.socket.send(JSON.stringify({
      type: 'event-heat',
      event: event,
      heat: heat,
      meetNumber: selectedMeetNumber,
      sessionNumber: selectedSessionNumber
    }));
}

// ------------------------------------------------------------------
// Event/Heat Info Bar Update
// ------------------------------------------------------------------
async function updateEventHeatInfoBar(eventNr, heatNr) {
    try {
        // Always include meet/session, fallback to first if not set
        let meet = selectedMeetNumber;
        let session = selectedSessionNumber;
        if (!meet || !session) {
            if (meetsData.length > 0) {
                meet = meetsData[0].meetNumber;
                session = meetsData[0].sessions[0].sessionNumber;
            }
        }
        // Fetch event data
        const eventRes = await fetch(`/competition/event/${eventNr}?meet=${meet}&session=${session}`);
        if (!eventRes.ok) throw new Error('Event fetch failed');
        const eventData = await eventRes.json();
        const maxHeatNr = eventData.heats.length; // last item

        // Format swim style
        const { distance, relaycount, stroke } = eventData.swimstyle || {};
        const strokeTranslation = {
            FREE: 'Vrijeslag',
            BACK: 'Rugslag',
            MEDLEY: 'Wisselslag',
            BREAST: 'Schoolslag',
            FLY: 'Vlinderslag'
        };
        const translatedStroke = strokeTranslation[stroke] || stroke || '';
        const length = relaycount > 1 ? `${relaycount}x${distance}` : `${distance}`;
        const infoText = `${eventNr} - ${length}m ${translatedStroke} - serie ${heatNr}/${maxHeatNr}`;

        // Update info bar
        const infoBar = document.getElementById('event-heat-info-bar');
        if (infoBar) infoBar.textContent = infoText;
    } catch {
        const infoBar = document.getElementById('event-heat-info-bar');
        if (infoBar) infoBar.textContent = 'Onbekend event/serie';
    }
}

// ------------------------------------------------------------------
// Main initialization and event handlers
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    let stopwatchInterval;

    // Initialize TimeSync with callbacks
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
        }
    });

    // Get elements
    const stopwatchElement = document.getElementById('stopwatch');
    const startButton = document.getElementById('start-button');
    const clearScreenButton = document.getElementById('clear-screen');
    const incrementEventButton = document.getElementById('increment-event');
    const incrementHeatButton = document.getElementById('increment-heat');
    // Initialize global select elements
    eventSelect = document.getElementById('event-select');
    heatSelect = document.getElementById('heat-select');
    const laneButtons = document.querySelectorAll('.lane-button');

    const controlElements = [eventSelect, heatSelect, incrementEventButton, incrementHeatButton];

    function startStopwatch(sendSocket = true, startTimeOverride = null) {
        if (stopwatchInterval) return; // Prevent multiple intervals
        if (startTimeOverride) {
            startTime = startTimeOverride;
        } else {
            // Gebruik altijd serverTimeOffset bij start
            startTime = Date.now() + serverTimeOffset;
        }
        // Start een interval om de stopwatch te laten lopen
        stopwatchInterval = setInterval(() => updateStopwatch(startTime, stopwatchElement), 10);
        resetSplitTimes();
        if (sendSocket) {
            window.socket.send(JSON.stringify({
                type: 'start',
                timestamp: startTime,
                heat: heatSelect.value,
                event: eventSelect.value,
                meetNumber: selectedMeetNumber,
                sessionNumber: selectedSessionNumber
            }));
        }
        disableControls(true, controlElements);

        // Update button appearance
        startButton.textContent = 'Stop stopwatch';
        startButton.classList.remove('bg-green-600', 'hover:bg-green-700');
        startButton.classList.add('bg-red-600', 'hover:bg-red-700');
    }

    function resetStopwatch(sendSocket = true) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        window.startTime = null;
        stopwatchElement.textContent = '00:00:00';
        if (sendSocket) {
            window.socket.send(JSON.stringify({ type: 'reset' }));
        }
        disableControls(false, controlElements);

        // Update button appearance
        startButton.textContent = 'Start stopwatch';
        startButton.classList.remove('bg-red-600', 'hover:bg-red-700');
        startButton.classList.add('bg-green-600', 'hover:bg-green-700');
    }

    // Event listeners
    clearScreenButton.addEventListener('click', () => {
        window.socket.send(JSON.stringify({ type: 'clear' }));
    });

    startButton.addEventListener('click', () => {
        if (stopwatchInterval) {
            resetStopwatch();
        } else {
            startStopwatch();
        }
    });

    // Remove reset button event listener since we no longer have that button
    // resetButton.addEventListener('click', () => resetStopwatch());

    incrementEventButton.addEventListener('click', incrementEvent);
    incrementHeatButton.addEventListener('click', incrementHeat);

    eventSelect.addEventListener('change', () => {
        // When event changes, update heats for the new event
        window.updateHeatSelectForEvent(eventSelect.value);
        // After heats are updated, select first heat and send
        setTimeout(() => {
          heatSelect.value = heatSelect.options[0]?.value ?? '';
          sendEventAndHeat(eventSelect.value, heatSelect.value);
          updateEventHeatInfoBar(eventSelect.value, heatSelect.value);
        }, 0);
    });

    heatSelect.addEventListener('change', () => {
        sendEventAndHeat(eventSelect.value, heatSelect.value);
        updateEventHeatInfoBar(eventSelect.value, heatSelect.value);
    });

    // Lane button handlers
    laneButtons.forEach(button => {
        button.addEventListener('click', () => {
            const lane = button.getAttribute('data-lane');
            // Use server-synchronized timestamp for sending, but calculate display time consistently
            const lapTimestamp = Date.now() + serverTimeOffset;
            // For display, use the same calculation as will be used on screen
            updateLaneInfo(lane, window.formatLapTime(lapTimestamp, startTime || 0));
            window.socket.send(JSON.stringify({ type: 'split', lane, timestamp: lapTimestamp }));
            highlightLaneButton(button);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
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

    // WebSocket initialization
    window.socket.addEventListener('open', function () {
        fillSelectOptions(eventSelect, 25);
        fillSelectOptions(heatSelect, 25);
        
        // Start initial fast sync sequence
        let pingCount = 0;
        const maxInitialPings = 5;
        const initialPingInterval = 500; // 500ms for initial sync
        const normalPingInterval = 5000; // 5 seconds for normal operation
        
        // Initial rapid ping sequence
        const initialSync = setInterval(() => {
            sendPing();
            pingCount++;
            
            if (pingCount >= maxInitialPings) {
                clearInterval(initialSync);
                // Switch to normal ping interval
                setInterval(sendPing, normalPingInterval);
                console.log('[Remote] Switched to normal ping interval after initial sync');
            }
        }, initialPingInterval);
        
        // Fetch and display initial event/heat info bar
        updateEventHeatInfoBar(eventSelect.value || 1, heatSelect.value || 1);
    });

    // WebSocket message handler
    window.socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);

        /** Start the stopwatch */
        if (message.type === 'start') {
            // Use the same timestamp as all other devices - don't add individual offset
            startTime = message.timestamp;
            window.startTime = startTime;
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
            }
            // Start een interval om de stopwatch te laten lopen bij ontvangen van start
            stopwatchInterval = setInterval(() => updateStopwatch(startTime, stopwatchElement), 10);
            for (let i = 0; i <= 9; i++) {
                updateLaneInfo(i, '---:---:---');
            }
            return;
        }

        /** Stop the stopwatch */
        if (message.type === 'reset') {
            resetStopwatch(false);
            return;
        }

        /** Update lane information */
        if (message.type === 'split') {
            const lane = message.lane;
            if (message.timestamp) {
                // When receiving split from server, the timestamp is already server-synchronized
                updateLaneInfo(lane, window.formatLapTime(message.timestamp, startTime || 0));
            }
            const button = document.querySelector(`.lane-button[data-lane="${lane}"]`);
            if (button) {
                highlightLaneButton(button);
            }
            return;
        }

        /** Change event and heat information */
        if (message.type === 'event-heat') {
            eventSelect.value = message.event;
            heatSelect.value = message.heat;
            resetSplitTimes();
            updateEventHeatInfoBar(message.event, message.heat);
        }

        /** Clear all lane information */
        if (message.type === 'clear') {
            clearLaneInformation();
            return;
        }

        /** Handle ping and time synchronization */
        if (message.type === 'ping') {
            const clientPingTime = Date.now();
            window.socket.send(JSON.stringify({ type: 'pong', client_ping_time: clientPingTime }));
            return;
        }

        /** Update server time offset */
        if (message.type === 'pong' || message.type === 'time_sync') {
            timeSync.processTimeSync(message);
            return;
        }
    });
});
