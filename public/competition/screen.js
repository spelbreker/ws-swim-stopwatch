document.addEventListener('DOMContentLoaded', function () {
    let stopwatchInterval;
    let startTime;
    const stopwatchElement = document.getElementById('stopwatch');

    function updateStopwatch() {
        if (!startTime) {
            stopwatchElement.textContent = '00:00:00';
            return;
        }
        const currentTime = Date.now();
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

    function fetchCompetitionData(eventNum, heatNum) {
        // Fetch event data first
        fetch(`/competition/event?event=${eventNum}`)
            .then(response => response.json())
            .then(eventData => {
                const swimStyleElement = document.getElementById('swim-style');
                if (swimStyleElement) {
                    swimStyleElement.textContent = formatSwimStyle(eventData.swimstyle);
                }
                
                // Then fetch heat data
                return fetch(`/competition/heat?event=${eventNum}&heat=${heatNum}`);
            })
            .then(response => response.json())
            .then(heatData => {
                updateLaneInformation(heatData);
            })
            .catch(error => {
                clearLaneInformation();
                console.error('Error fetching competition data:', JSON.parse(error.message));
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
            laneElement.querySelector('.split-time').textContent = '---:---:---';
            
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

    function resetSplitTimes() {
        document.querySelectorAll('.split-time').forEach(element => {
            element.textContent = '---:---:---';
        });
    }

    // Initialize with first event and heat
    fetchCompetitionData(1, 1);

    function formatSwimStyle(swimstyle) {
        if (!swimstyle) return '';
        const { distance, relaycount, stroke } = swimstyle;
        if (relaycount > 1) {
            return `${relaycount} x ${distance}M ${stroke}`;
        }
        return `${distance}M ${stroke}`;
    }

    // Add WebSocket message handler for screen updates
    window.socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);
        if (message.type === 'start') {
            startTime = Date.now();
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
            }
            stopwatchInterval = setInterval(updateStopwatch, 10);
        } else if (message.type === 'reset') {
            if (stopwatchInterval) {
                clearInterval(stopwatchInterval);
                stopwatchInterval = null;
            }
            startTime = null;
            stopwatchElement.textContent = '00:00:00';
        } else if (message.type === 'split') {
            const laneElement = document.getElementById(`lane-${message.lane}`);
            if (laneElement) {
                laneElement.querySelector('.split-time').textContent = message.time;
                laneElement.classList.add('highlight');
                setTimeout(() => laneElement.classList.remove('highlight'), 2000);
            }
        } else if (message.type === 'event-heat') {
            document.getElementById('event-number').textContent = message.event;
            document.getElementById('heat-number').textContent = message.heat;
            fetchCompetitionData(message.event, message.heat);
        } else if (message.type === 'clear') {
            clearLaneInformation();
        }
    });
});
