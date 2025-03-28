document.addEventListener('DOMContentLoaded', function () {
    // Initialize global variables
    window.socket = null;
    let connectionCheckInterval;
    let wakeLock = null;

    // Wake Lock functionality
    async function requestWakeLock() {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock is active');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
                console.log('Wake lock was released');
            });
        } catch (err) {
            console.error('Failed to acquire wake lock:', err);
        }
    }

    if ('wakeLock' in navigator) {
        requestWakeLock();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState == 'visible' && !wakeLock) {
                requestWakeLock();
            }
        });
    }

    // WebSocket setup
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        window.socket = new WebSocket(protocol + window.location.host);

        window.socket.addEventListener('open', function () {
            const connectionIndicator = document.getElementById('connection-indicator');
            if (connectionIndicator) {
                connectionIndicator.classList.remove('bg-red-500');
                connectionIndicator.classList.add('bg-green-500');
            }
            startConnectionCheck();
        });

        window.socket.addEventListener('close', function () {
            const connectionIndicator = document.getElementById('connection-indicator');
            if (navigator.onLine && connectionIndicator) {
                connectionIndicator.classList.remove('bg-green-500');
                connectionIndicator.classList.add('bg-red-500');
            }
            stopConnectionCheck();
            setTimeout(connectWebSocket, 1000);
        });
    }

    function startConnectionCheck() {
        connectionCheckInterval = setInterval(() => {
            const connectionIndicator = document.getElementById('connection-indicator');
            if ((window.socket.readyState !== WebSocket.OPEN || !navigator.onLine) && connectionIndicator) {
                connectionIndicator.classList.remove('bg-green-500');
                connectionIndicator.classList.add('bg-red-500');
                connectWebSocket();
            }
        }, 2000);
    }

    function stopConnectionCheck() {
        clearInterval(connectionCheckInterval);
    }

    // Initialize WebSocket connection
    connectWebSocket();

    // Expose shared utility functions
    window.fillSelectOptions = function(selectElement, maxValue) {
        if (!selectElement) return;
        for (let i = 1; i <= maxValue; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            selectElement.appendChild(option);
        }
    };

    window.clearLaneInformation = function() {
        for (let i = 0; i <= 9; i++) {
            const laneElement = document.getElementById(`lane-${i}`);
            if (laneElement) {
                laneElement.querySelector('.athlete').textContent = '';
                laneElement.querySelector('.club').textContent = '';
                laneElement.querySelector('.split-time').textContent = '---:---:---';
            }
        }
    };

    window.resetSplitTimes = function() {
        document.querySelectorAll('.split-time').forEach(element => {
            element.textContent = '---:---:---';
        });
    };

    window.fetchCompetitionData = function(event, heat) {
        fetch(`/competition/events-list?event=${event}&heat=${heat}`)
            .then(response => response.json())
            .then(data => {
                window.updateLaneInformation(data.entries);
                const swimStyleElement = document.getElementById('swim-style');
                if (swimStyleElement) {
                    swimStyleElement.textContent = data.event.swimstyle;
                }
            })
            .catch(error => {
                window.clearLaneInformation();
                console.error('Error fetching competition data:', error.message);
            });
    };

    window.updateLaneInformation = function(entries) {
        window.clearLaneInformation();
        // Handle both array of entries and single entries
        if (!Array.isArray(entries)) {
            entries = [entries];
        }
        
        entries.forEach(entry => {
            if (Array.isArray(entry)) {
                // Handle multiple athletes per lane
                entry.forEach(athlete => updateLaneDisplay(athlete));
            } else {
                // Handle single athlete
                updateLaneDisplay(entry);
            }
        });
    };

    function updateLaneDisplay(athlete) {
        const laneElement = document.getElementById(`lane-${athlete.lane}`);
        if (laneElement) {
            laneElement.querySelector('.club').textContent = athlete.club;
            laneElement.querySelector('.split-time').textContent = '---:---:---';
            if (athlete.athletes && athlete.athletes.length > 0) {
                let athleteNames = athlete.athletes.map(a => 
                    `${a.firstname.substring(0, 3)}..`).join(' / ');
                laneElement.querySelector('.athlete').textContent = athleteNames;
            } else {
                laneElement.querySelector('.athlete').textContent = 
                    `${athlete.firstname} ${athlete.lastname}`;
            }
        }
    }
});
