// ------------------------------------------------------------------
// Global variables
// ------------------------------------------------------------------
let stopwatchInterval;
let startTime;
let stopwatchElement;
let serverTimeOffset = 0;
let arrivalOrder = 1; // Track next arrival order number
let arrivalClearTimer = null; // Timer for clearing arrival order numbers
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
let cachedCompetitionMeets = null;
async function getCompetitionMeets() {
    if (cachedCompetitionMeets) return cachedCompetitionMeets;
    const res = await fetch('/competition/meets');
    const data = await res.json();
    cachedCompetitionMeets = data;
    return data;
}

async function fetchCompetitionData(eventNum, heatNum) {
    // Always include meet/session, fallback to first if not set
    let meet = window.selectedMeetNumber;
    let session = window.selectedSessionNumber;
    // Fallback: fetch first meet/session if not set
    if (!meet || !session) {
        const data = await getCompetitionMeets();
        if (data.length > 0) {
            meet = data[0].meetNumber;
            session = data[0].sessions[0].sessionNumber;
            window.selectedMeetNumber = meet;
            window.selectedSessionNumber = session;
        } else {
            clearLaneInformation();
            return;
        }
    }
    // If eventNum is missing, fetch first event for meet/session
    if (!eventNum) {
        const data = await getCompetitionMeets();
        const foundMeet = data.find(m => m.meetNumber === meet);
        const foundSession = foundMeet?.sessions.find(s => s.sessionNumber === session);
        const firstEvent = foundSession?.events?.[0]?.number || 1;
        await fetchCompetitionData(firstEvent, heatNum);
        return;
    }
    // Fetch event data first
    const eventResponse = await fetch(`/competition/event/${eventNum}?meet=${meet}&session=${session}`);

    if (!eventResponse.ok) {
        // If event not found in specified session, try to find it in other sessions
        console.warn(`Event ${eventNum} not found in session ${session}, searching other sessions...`);
        const correctSession = await findEventInAllSessions(meet, eventNum);
        if (correctSession) {
            console.log(`Found event ${eventNum} in session ${correctSession}, updating URL...`);
            window.selectedSessionNumber = correctSession;
            updateURLParameters(meet, correctSession, eventNum, heatNum);
            // Retry with correct session
            await fetchCompetitionData(eventNum, heatNum);
            return;
        } else {
            throw new Error(`Event ${eventNum} not found in any session of meet ${meet}`);
        }
    }

    const eventData = await eventResponse.json();
    const swimStyleElement = document.getElementById('swim-style');
    if (swimStyleElement) {
        swimStyleElement.textContent = formatSwimStyle(eventData.swimstyle);
    }

    // Then fetch heat data
    const heatResponse = await fetch(`/competition/event/${eventNum}/heat/${heatNum}?meet=${meet}&session=${session}`);
    if (!heatResponse.ok) {
        throw new Error(`Heat ${heatNum} not found for event ${eventNum}`);
    }

    const heatData = await heatResponse.json();
    updateLaneInformation(heatData);
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
// URL parameter handling
// ------------------------------------------------------------------
function getURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        meet: urlParams.get('meet') ? parseInt(urlParams.get('meet'), 10) : null,
        session: urlParams.get('session') ? parseInt(urlParams.get('session'), 10) : null,
        event: urlParams.get('event') ? parseInt(urlParams.get('event'), 10) : null,
        heat: urlParams.get('heat') ? parseInt(urlParams.get('heat'), 10) : null
    };
}

function updateURLParameters(meet, session, event, heat) {
    const url = new URL(window.location);
    if (meet) url.searchParams.set('meet', meet);
    if (session) url.searchParams.set('session', session);
    if (event) url.searchParams.set('event', event);
    if (heat) url.searchParams.set('heat', heat);
    window.history.replaceState({}, '', url);
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

    // Read URL parameters and initialize global variables
    const initialParams = getURLParameters();
    window.selectedMeetNumber = initialParams.meet;
    window.selectedSessionNumber = initialParams.session;

    // Initialize with URL parameters or defaults
    const eventNum = initialParams.event || 1;
    const heatNum = initialParams.heat || 1;

    // Update display with URL parameters
    document.getElementById('event-number').textContent = eventNum;
    document.getElementById('heat-number').textContent = heatNum;

    (async () => {
        try {
            await fetchCompetitionData(eventNum, heatNum);
        } catch (error) {
            console.error('Failed to fetch competition data:', error);
            clearLaneInformation();
        }
    })();

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
                        // Use the same calculation method as remote: timestamp vs startTime directly
                        const formattedTime = window.formatLapTime(message.timestamp, startTime || 0);
                        const currentArrivalOrder = arrivalOrder;

                        // Display time and arrival order in separate columns
                        splitCell.textContent = formattedTime;
                        arrivalCell.textContent = currentArrivalOrder;

                        // Increment arrival order for next split
                        if(arrivalOrder < 10) {
                            // Only increment if we have less than 10 arrivals
                            arrivalOrder++;
                        }

                        // Start 20-second timer after first split
                        if (currentArrivalOrder === 1) {
                            arrivalClearTimer = setTimeout(() => {
                                clearArrivalOrders();
                            }, 20000);
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

            // Update meet and session if provided in the message
            if (message.meetNumber !== undefined) {
                window.selectedMeetNumber = parseInt(message.meetNumber, 10);
            }
            if (message.sessionNumber !== undefined) {
                window.selectedSessionNumber = parseInt(message.sessionNumber, 10);
            }

            // Update URL parameters to reflect the change
            updateURLParameters(window.selectedMeetNumber, window.selectedSessionNumber, message.event, message.heat);

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
            timeSync.processTimeSync(message);
            return;
        }
    });

    // Handle URL parameters on initial load
    const urlParams = getURLParameters();
    if (urlParams.meet && urlParams.session) {
        window.selectedMeetNumber = urlParams.meet;
        window.selectedSessionNumber = urlParams.session;
        // Fetch and display the correct event/heat if specified
        fetchCompetitionData(urlParams.event, urlParams.heat);
    }
});

async function findEventInAllSessions(meet, eventNum) {
    try {
        const meetsData = await getCompetitionMeets();
        const foundMeet = meetsData.find(m => m.meetNumber === meet);
        if (!foundMeet) return null;

        for (const session of foundMeet.sessions) {
            const response = await fetch(`/competition/event/${eventNum}?meet=${meet}&session=${session.sessionNumber}`);
            if (response.ok) {
                return session.sessionNumber;
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding event in sessions:', error);
        return null;
    }
}
