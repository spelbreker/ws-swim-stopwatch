// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let startTime;
let eventSelect;
let heatSelect;
let currentSession = null; // Current selected session number
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
        const sessionParam = currentSession ? `?session=${currentSession}` : '';
        fetch(`/competition/event${sessionParam}`)
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
    const message = { type: 'event-heat', event: event, heat: heat };
    if (currentSession) {
        message.session = currentSession;
    }
    window.socket.send(JSON.stringify(message));
}

// ------------------------------------------------------------------
// Event/Heat Info Bar Update
// ------------------------------------------------------------------
async function updateEventHeatInfoBar(eventNr, heatNr) {
    try {
        // Fetch event data
        const sessionParam = currentSession ? `?session=${currentSession}` : '';
        const eventRes = await fetch(`/competition/event/${eventNr}${sessionParam}`);
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
    } catch (err) {
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
            window.socket.send(JSON.stringify({ type: 'start', timestamp: startTime, heat: heatSelect.value, event: eventSelect.value }));
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
        heatSelect.value = 1;
        sendEventAndHeat(eventSelect.value, 1);
        updateEventHeatInfoBar(eventSelect.value, 1);
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

    // Session functionality
    const sessionMenuButton = document.getElementById('session-menu-button');
    const sessionDialog = document.getElementById('session-dialog');
    const sessionList = document.getElementById('session-list');
    const closeSessionDialog = document.getElementById('close-session-dialog');
    const sessionIndicator = document.getElementById('session-indicator');

    // Load sessions and setup session selector
    function loadSessions() {
        fetch('/competition/sessions')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch sessions');
                return res.json();
            })
            .then(sessions => {
                sessionList.innerHTML = '';
                sessions.forEach(session => {
                    const listItem = document.createElement('li');
                    listItem.className = 'cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors';

                    // Format the date and time
                    const sessionTime = session.daytime ? ` ${session.daytime}` : '';

                    listItem.innerHTML = `
                        <div class="text-left">
                            <div class="font-medium text-gray-900 dark:text-gray-100">Session ${session.number}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${session.date}${sessionTime}</div>
                        </div>
                    `;
                    listItem.addEventListener('click', () => selectSession(session.number));
                    sessionList.appendChild(listItem);
                });

                // Set default session if none selected
                if (!currentSession && sessions.length > 0) {
                    currentSession = sessions[0].number;
                    updateSessionIndicator();
                }
            })
            .catch(error => {
                console.error('Error loading sessions:', error);
                // Fallback: assume session 1
                if (!currentSession) {
                    currentSession = 1;
                    updateSessionIndicator();
                }
            });
    }

    function selectSession(sessionNumber) {
        currentSession = sessionNumber;
        updateSessionIndicator();
        sessionDialog.classList.add('hidden');

        // Refresh event list for the new session
        fillSelectOptions(eventSelect, 25);

        // Wait for event list to be populated, then select first event and heat
        setTimeout(() => {
            const firstEvent = eventSelect.options[0]?.value || 1;
            const firstHeat = 1;

            // Update the select elements
            eventSelect.value = firstEvent;
            heatSelect.value = firstHeat;

            // Send event-heat message to update screen
            sendEventAndHeat(firstEvent, firstHeat);

            // Update event/heat info bar
            updateEventHeatInfoBar(firstEvent, firstHeat);
        }, 100); // Small delay to ensure event list is populated
    }

    function updateSessionIndicator() {
        if (sessionIndicator && currentSession) {
            sessionIndicator.textContent = `Session ${currentSession}`;
        }
    }

    // Event listeners for session dialog
    sessionMenuButton.addEventListener('click', () => {
        sessionDialog.classList.remove('hidden');
    });

    closeSessionDialog.addEventListener('click', () => {
        sessionDialog.classList.add('hidden');
    });

    sessionDialog.addEventListener('click', (e) => {
        if (e.target === sessionDialog) {
            sessionDialog.classList.add('hidden');
        }
    });

    // Load sessions on initialization
    loadSessions();
});
