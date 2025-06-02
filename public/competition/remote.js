// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let startTime;
let eventSelect;
let heatSelect;
// Global variable for ping
let pingStartTime;

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
        fetch('/competition/event')
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
    const elapsedTime = Date.now() - startTime;
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
    window.socket.send(JSON.stringify({ type: 'event-heat', event: event, heat: heat }));
}

// ------------------------------------------------------------------
// Event/Heat Info Bar Update
// ------------------------------------------------------------------
async function updateEventHeatInfoBar(eventNr, heatNr) {
    try {
        // Fetch event data
        const eventRes = await fetch(`/competition/event/${eventNr}`);
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
            startTime = Date.now();
        }
        stopwatchInterval = setInterval(() => updateStopwatch(startTime, stopwatchElement), 10);
        resetSplitTimes();
        if (sendSocket) {
            window.socket.send(JSON.stringify({ type: 'start', time: startTime }));
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
            const time = stopwatchElement.textContent;
            
            updateLaneInfo(lane, time);
            window.socket.send(JSON.stringify({ type: 'split', lane, time }));
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
    window.socket.addEventListener('open', function() {
        fillSelectOptions(eventSelect, 25);
        fillSelectOptions(heatSelect, 25);
        setInterval(sendPing, 5000); // send ping every 5 seconds
        // Fetch and display initial event/heat info bar
        updateEventHeatInfoBar(eventSelect.value || 1, heatSelect.value || 1);
    });

    // WebSocket message handler
    window.socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);
        if (message.type === 'start') {
            //latency compensation
            const latency = Date.now() - message.time;
            startTime = Date.now() - latency;
            // Start the stopwatch with the adjusted start time
            startStopwatch(false, startTime);
            console.log('Latency:', latency);
        } else if (message.type === 'reset') {
            resetStopwatch(false);
        } else if (message.type === 'split') {
            const lane = message.lane;
            updateLaneInfo(lane, message.time);
            const button = document.querySelector(`.lane-button[data-lane="${lane}"]`);
            if (button) {
                highlightLaneButton(button);
            }
        } else if (message.type === 'event-heat') {
            eventSelect.value = message.event;
            heatSelect.value = message.heat;
            fetchCompetitionData(message.event, message.heat);
            resetSplitTimes();
            updateEventHeatInfoBar(message.event, message.heat);
        } else if (message.type === 'clear') {
            clearLaneInformation();
        } else if (message.type === 'pong') { // New handling for pong response
            const pingTime = Date.now() - message.time;
            const pingDisplay = document.getElementById('ping-display');
            if (pingDisplay) {
                pingDisplay.textContent = `${pingTime} ms`;
            }
        }
    });
});
