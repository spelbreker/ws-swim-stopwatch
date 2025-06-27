// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let stopwatchInterval;
let startTime;
let stopwatchElement;
let serverTimeOffset = 0;
let arrivalOrder = 1; // Track next arrival order number
let arrivalClearTimer = null; // Timer for clearing arrival order numbers

// ------------------------------------------------------------------
// Stopwatch functions
// ------------------------------------------------------------------
function updateStopwatch() {
    if (!startTime) {
        stopwatchElement.textContent = '00:00:00';
        return;
    }
    const currentTime = Date.now() + serverTimeOffset;
    const elapsedTime = currentTime - startTime;
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    const milliseconds = Math.floor((elapsedTime % 1000) / 10);
    stopwatchElement.textContent =
        `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
}

function pad(number) {
    return number.toString().padStart(2, '0');
}

// ------------------------------------------------------------------
// Competition data handling
// ------------------------------------------------------------------
function fetchCompetitionData(eventNum, heatNum) {
    // Fetch event data first
    fetch(`/competition/event/${eventNum}`)
        .then(response => response.json())
        .then(eventData => {
            const swimStyleElement = document.getElementById('swim-style');
            if (swimStyleElement) {
                swimStyleElement.textContent = formatSwimStyle(eventData.swimstyle);
            }

            // Then fetch heat data
            return fetch(`/competition/event/${eventNum}/heat/${heatNum}`);
        })
        .then(response => response.json())
        .then(heatData => {
            updateLaneInformation(heatData);
        })
        .catch(error => {
            clearLaneInformation();
            console.warn('Error fetching competition data');
        });
}

function updateLaneInformation(entries) {
    clearLaneInformation();
    if (!Array.isArray(entries)) {
        entries = [entries];
    }
    entries.forEach(entry => {
        if (Array.isArray(entry)) {
            entry.forEach(athlete => updateLaneDisplay(athlete));
        } else {
            updateLaneDisplay(entry);
        }
    });
}

function updateLaneDisplay(athlete) {
    const laneElement = document.getElementById(`lane-${athlete.lane}`);
    if (laneElement) {
        laneElement.querySelector('.club').textContent = athlete.club;
        clearSplitTimes();

        if (athlete.athletes) {
            let athleteNames = athlete.athletes.length === 1
                ? `${athlete.athletes[0].firstname} ${athlete.athletes[0].lastname}`
                : athlete.athletes.map(a => `${a.firstname.substring(0, 3)}...`).join(' / ');
            laneElement.querySelector('.athlete').textContent = athleteNames;
        } else {
            laneElement.querySelector('.athlete').textContent =
                `${athlete.firstname} ${athlete.lastname}`;
        }
    }
}

function formatLapTime(ts) {
    // Zet timestamp om naar mm:ss:ms
    const base = startTime || 0;
    return window.formatLapTime(ts, base);
}

function clearLaneInformation() {
    for (let i = 0; i <= 9; i++) {
        const laneElement = document.getElementById(`lane-${i}`);
        if (laneElement) {
            laneElement.querySelector('.athlete').textContent = '';
            laneElement.querySelector('.club').textContent = '';
            laneElement.querySelector('.split-time').textContent = '---:---:---';
            laneElement.querySelector('.arrival-order').textContent = '';
        }
    }
}

function clearSplitTimes() {
    document.querySelectorAll('.split-time').forEach(element => {
        element.textContent = '---:---:---';
    });
}

function clearArrivalOrders() {
    // Clear arrival order numbers from all arrival-order cells
    document.querySelectorAll('.arrival-order').forEach(element => {
        element.textContent = '';
    });
    
    // Reset tracking variables
    arrivalOrder = 1;
    if (arrivalClearTimer) {
        clearTimeout(arrivalClearTimer);
        arrivalClearTimer = null;
    }
}

function resetArrivalOrderTracking() {
    // Reset only the tracking variables, don't clear displayed orders
    arrivalOrder = 1;
    if (arrivalClearTimer) {
        clearTimeout(arrivalClearTimer);
        arrivalClearTimer = null;
    }
}

// ------------------------------------------------------------------
// Formatting and translation
// ------------------------------------------------------------------
function formatSwimStyle(swimstyle) {
    if (!swimstyle) return '';
    const { distance, relaycount, stroke } = swimstyle;
    const strokeTranslation = {
        FREE: 'Vrije slag',
        BACK: 'Rugslag',
        MEDLEY: 'Wisselslag',
        BREAST: 'Schoolslag',
        FLY: 'Vlinderslag'
    };
    const translatedStroke =  strokeTranslation[stroke] || stroke;
    if (relaycount > 1) {
        return `${relaycount} x ${distance}M ${translatedStroke}`;
    }
    return `${distance}M ${translatedStroke}`;
}

// ------------------------------------------------------------------
// Initialization and event handlers
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    // Initialize elements
    stopwatchElement = document.getElementById('stopwatch');

    // Initialize with first event and heat
    fetchCompetitionData(1, 1);

    // Add WebSocket message handler for screen updates
    window.socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);

        /** Start the stopwatch */
        if (message.type === 'start') {
            startTime = message.timestamp + serverTimeOffset;
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
            }
            stopwatchInterval = setInterval(updateStopwatch, 10);
            clearSplitTimes();
            resetArrivalOrderTracking(); // Reset arrival order tracking without clearing displayed orders
            return
        }

        /** Stop the stopwatch */
        if (message.type === 'reset') {
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
                stopwatchInterval = null;
            }
            startTime = null;
            stopwatchElement.textContent = '00:00:00';
            clearArrivalOrders(); // Reset arrival order tracking
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
                        const formattedTime = window.formatLapTime(message.timestamp, startTime || 0);
                        const currentArrivalOrder = arrivalOrder;
                        
                        // Display time and arrival order in separate columns
                        splitCell.textContent = formattedTime;
                        arrivalCell.textContent = currentArrivalOrder;
                        
                        // Increment arrival order for next split
                        arrivalOrder++;
                        
                        // Start 20-second timer after first split
                        if (currentArrivalOrder === 1) {
                            arrivalClearTimer = setTimeout(() => {
                                clearArrivalOrders();
                            }, 20000); // 20 seconds as requested
                        }
                    }
                    laneElement.classList.add('highlight');
                    setTimeout(() => laneElement.classList.remove('highlight'), 2000);
                }
            }
            return;
        }

        /** change event and heat information */
        if (message.type === 'event-heat') {
            document.getElementById('event-number').textContent = message.event;
            document.getElementById('heat-number').textContent = message.heat;
            fetchCompetitionData(message.event, message.heat);
            return;
        }

        /** clear all lane information */
        if (message.type === 'clear') {
            clearLaneInformation();
            clearArrivalOrders(); // Reset arrival order tracking
            return;
        }

        /** Update server time offset */
        if (message.type === 'pong' || message.type === 'time_sync') {
            let rtt = 0;
            if (message.type === 'pong') {
                rtt = Date.now() - message.client_ping_time;
            }
            const estimatedServerTimeNow = message.server_time + (rtt / 2);
            serverTimeOffset = estimatedServerTimeNow - Date.now();
            return;
        }
    });
});
