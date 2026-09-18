// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let stopwatchInterval;
let startTime;
let stopwatchElement;
let serverTimeOffset = 0;
// Time synchronization instance
let timeSync;

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
function fetchCompetitionData(eventNum, heatNum, sessionNum = null) {
    // Build session parameter
    const sessionParam = sessionNum ? `?session=${sessionNum}` : '';

    // Fetch event data first
    fetch(`/competition/event/${eventNum}${sessionParam}`)
        .then(response => response.json())
        .then(eventData => {
            const swimStyleElement = document.getElementById('swim-style');
            if (swimStyleElement) {
                swimStyleElement.textContent = formatSwimStyle(eventData.swimstyle);
            }

            // Then fetch heat data
            return fetch(`/competition/event/${eventNum}/heat/${heatNum}${sessionParam}`);
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
            laneElement.classList.remove('finished');
        }
    }
}

function clearSplitTimes() {
    document.querySelectorAll('.split-time').forEach(element => {
        element.textContent = '---:---:---';
    });
}

function clearArrivalOrders() {
    // Clear arrival order numbers and finish markers from all lanes
    document.querySelectorAll('.arrival-order').forEach(element => {
        element.textContent = '';
    });
    document.querySelectorAll('.lane.finished').forEach(element => {
        element.classList.remove('finished');
    });
}

function renderRanking(ranking) {
    // Server sends the full ranking on every accepted split; redraw all cells
    if (!Array.isArray(ranking)) return;
    document.querySelectorAll('.arrival-order').forEach(element => {
        element.textContent = '';
    });
    ranking.forEach(({ lane, place }) => {
        const laneElement = document.getElementById(`lane-${lane}`);
        const cell = laneElement && laneElement.querySelector('.arrival-order');
        if (cell) cell.textContent = place;
    });
}

function renderSplitTime(splitCell, distance, formattedTime) {
    splitCell.textContent = '';
    if (distance) {
        const label = document.createElement('span');
        label.className = 'split-distance';
        label.textContent = `${distance}m`;
        splitCell.appendChild(label);
        splitCell.appendChild(document.createTextNode(' '));
    }
    splitCell.appendChild(document.createTextNode(formattedTime));
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
    // Initialize TimeSync
    timeSync = new TimeSync({
        debugLogging: true,
        onOffsetUpdate: (offset) => {
            serverTimeOffset = offset;
        }
    });

    // Initialize elements
    stopwatchElement = document.getElementById('stopwatch');

    // Initialize with first event and heat
    fetchCompetitionData(1, 1);

    // Add WebSocket message handler for screen updates
    window.socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);

        /** Start the stopwatch */
        if (message.type === 'start') {
            // Use the same timestamp as all other devices - don't add individual offset
            startTime = message.timestamp;
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
            }
            stopwatchInterval = setInterval(updateStopwatch, 10);
            clearSplitTimes();
            clearArrivalOrders();
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
                    if (splitCell) {
                        // Use the same calculation method as remote: timestamp vs startTime directly
                        const formattedTime = window.formatLapTime(message.timestamp, startTime || 0);
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

        /** change event and heat information */
        if (message.type === 'event-heat' || message.type === 'select-event') {
            document.getElementById('event-number').textContent = message.event;
            document.getElementById('heat-number').textContent = message.heat;
            clearArrivalOrders();
            fetchCompetitionData(message.event, message.heat, message.session);
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
            timeSync.processTimeSync(message);
            return;
        }
    });
});
