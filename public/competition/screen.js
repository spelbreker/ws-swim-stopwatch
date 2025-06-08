// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let stopwatchInterval;
let startTime;
let stopwatchElement;
let serverTimeOffset = 0;

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
    const base = window.startTime || 0;
    return window.formatLapTime(ts, base);
}

function formatLapTime(ts) {
    // Zet timestamp om naar mm:ss:ms
    const base = window.startTime || 0;
    return window.formatLapTime(ts, base);
}

function clearLaneInformation() {
    for (let i = 0; i <= 9; i++) {
        const laneElement = document.getElementById(`lane-${i}`);
        if (laneElement) {
            laneElement.querySelector('.athlete').textContent = '';
            laneElement.querySelector('.club').textContent = '';
            laneElement.querySelector('.split-time').textContent = '---:---:---';
        }
    }
}

function clearSplitTimes() {
    document.querySelectorAll('.split-time').forEach(element => {
        element.textContent = '---:---:---';
    });
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
            window.startTime = startTime;
            startTime = message.timestamp + serverTimeOffset;
            window.startTime = startTime;
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
            }
            stopwatchInterval = setInterval(updateStopwatch, 10);
            clearSplitTimes();
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
                        splitCell.textContent = window.formatLapTime(message.timestamp, window.startTime || 0);
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
