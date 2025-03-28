document.addEventListener('DOMContentLoaded', function () {
    const isRemotePage = window.location.pathname.includes('remote.html');
    const isScreenPage = window.location.pathname.includes('screen.html');

    let stopwatchInterval;
    let startTime;
    const stopwatchElement = document.getElementById('stopwatch');
    const heatElement = document.getElementById('heat-number');
    const eventElement = document.getElementById('event-number');
    const laneButtons = document.querySelectorAll('.lane-button');
    const eventSelect = document.getElementById('event-select');
    const heatSelect = document.getElementById('heat-select');
    const incrementEventButton = document.getElementById('increment-event');
    const incrementHeatButton = document.getElementById('increment-heat');
    const clearScreenButton = document.getElementById('clear-screen');
    const connectionIndicator = document.getElementById('connection-indicator');
    const swimStyleElement = document.getElementById('swim-style');
    let socket;
    let connectionCheckInterval;
    let wakeLock = null;

    // Request a wake lock
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

    // Enable wake lock when the page is loaded
    if ('wakeLock' in navigator) {
        requestWakeLock();

        // Reacquire wake lock if visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState == 'visible' && !wakeLock) {
                requestWakeLock();
            }
        });
    } else {
        console.warn('Wake Lock API is not supported in this browser.');
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        socket = new WebSocket(protocol + window.location.host);

        socket.addEventListener('open', function () {
            console.log('WebSocket connection established');
            if (connectionIndicator) {
                connectionIndicator.classList.remove('bg-red-500');
                connectionIndicator.classList.add('bg-green-500');
            }
            startConnectionCheck();
        });

        socket.addEventListener('close', function () {
            console.log('WebSocket connection closed, attempting to reconnect...');
            if (navigator.onLine) {
                connectionIndicator.classList.remove('bg-green-500');
                connectionIndicator.classList.add('bg-red-500');
            }
            stopConnectionCheck();
            setTimeout(connectWebSocket, 1000);
        });

        socket.addEventListener('message', function (event) {
            const message = JSON.parse(event.data);
            if (message.type === 'start') {
                startStopwatch(false);
            } else if (message.type === 'reset') {
                resetStopwatch(false);
            } else if (message.type === 'split') {
                const laneElement = document.getElementById(`lane-${message.lane}`);
                laneElement.querySelector('.split-time').textContent = message.time;
                laneElement.classList.add('highlight');
                setTimeout(() => {
                    laneElement.classList.remove('highlight');
                }, 2000);
            } else if (message.type === 'event-heat') {
                fetchCompetitionData(message.event, message.heat);
                if (isScreenPage) {
                    eventElement.textContent = message.event;
                    heatElement.textContent = message.heat;
                }
                if (isRemotePage) {
                    eventSelect.value = message.event;
                    heatSelect.value = message.heat;
                }
                resetSplitTimes();
            } else if (message.type === 'clear') {
                clearLaneInformation();
            }
        });
    }

    connectWebSocket();

    function startStopwatch(sendSocket = true) {
        startTime = Date.now();
        stopwatchInterval = setInterval(updateStopwatch, 10);
        resetSplitTimes();
        if (sendSocket) {
            socket.send(JSON.stringify({ type: 'start' }));
        }
        disableControls(true);
    }

    function resetStopwatch(sendSocket = true) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null; // Allow toggle logic via Enter key
        stopwatchElement.textContent = '00:00:00';
        if (sendSocket) {
            socket.send(JSON.stringify({ type: 'reset' }));
        }
        disableControls(false);
    }

    function updateStopwatch() {
        const elapsedTime = Date.now() - startTime;
        const minutes = Math.floor(elapsedTime / 60000);
        const seconds = Math.floor((elapsedTime % 60000) / 1000);
        const milliseconds = Math.floor((elapsedTime % 1000) / 10);
        stopwatchElement.textContent = `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
    }

    function sendProgramAndHeat(event, heat) {
        socket.send(JSON.stringify({ type: 'event-heat', event: event, heat: heat }));
    }

    function pad(number) {
        return number.toString().padStart(2, '0');
    }

    function highlightLaneButton(button) {
        button.classList.add('bg-green-500');
        button.classList.remove('bg-blue-500');
        setTimeout(() => {
            button.classList.remove('bg-green-500');
            button.classList.add('bg-blue-500');
        }, 10000);
    }

    function disableControls(disable) {
        if (eventSelect) eventSelect.disabled = disable;
        if (heatSelect) heatSelect.disabled = disable;
        if (incrementEventButton) incrementEventButton.disabled = disable;
        if (incrementHeatButton) incrementHeatButton.disabled = disable;

        const classAction = disable ? 'add' : 'remove';
        if (eventSelect) eventSelect.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        if (heatSelect) heatSelect.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        if (incrementEventButton) incrementEventButton.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        if (incrementHeatButton) incrementHeatButton.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
    }

    function incrementEvent() {
        let currentEvent = parseInt(eventSelect.value);
        if (currentEvent < 50) {
            eventSelect.value = currentEvent + 1;
            heatSelect.value = 1;
            sendProgramAndHeat(currentEvent + 1, 1);
        }
    }

    function incrementHeat() {
        let currentHeat = parseInt(heatSelect.value);
        if (currentHeat < 20) {
            heatSelect.value = currentHeat + 1;
            sendProgramAndHeat(parseInt(eventSelect.value), currentHeat + 1);
        }
    }

    function fillSelectOptions(selectElement, maxValue) {
        if (!selectElement) return;
        for (let i = 1; i <= maxValue; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            selectElement.appendChild(option);
        }
    }

    function resetSplitTimes() {
        document.querySelectorAll('.split-time').forEach(function (element) {
            element.textContent = '---:---:---';
        });
    }

    fillSelectOptions(eventSelect, 50);
    fillSelectOptions(heatSelect, 20);

    if (isRemotePage) {
        const startButton = document.getElementById('start-button');
        const resetButton = document.getElementById('reset-button');


        clearScreenButton.addEventListener('click', () => {
            socket.send(JSON.stringify({ type: 'clear' }));
        });
        startButton.addEventListener('click', startStopwatch);
        resetButton.addEventListener('click', resetStopwatch);
        incrementEventButton.addEventListener('click', incrementEvent);
        incrementHeatButton.addEventListener('click', incrementHeat);
        eventSelect.addEventListener('change', () => {
            heatSelect.value = 1;
            sendProgramAndHeat(eventSelect.value, 1);
        });
        heatSelect.addEventListener('change', () => {
            sendProgramAndHeat(eventSelect.value, heatSelect.value);
        });

        laneButtons.forEach(button => {
            button.addEventListener('click', () => {
                const lane = button.getAttribute('data-lane');
                const time = stopwatchElement.textContent;
                //send async to not block the UI
                new Promise((resolve, reject) => {
                    socket.send(JSON.stringify({ type: 'split', lane, time }));
                    document.getElementById(`lane-${lane}`).querySelector('.split-time').textContent = time;
                });
                highlightLaneButton(button);
            });
        });

        // Add key support: pressing keys 0-9 triggers the respective lane button
        document.addEventListener('keydown', function (e) {
            if (e.key >= '0' && e.key <= '9') {
                const button = document.querySelector(`.lane-button[data-lane="${e.key}"]`);
                if (button) {
                    button.click();
                }
            } else if (e.key === 'Enter') {
                if (stopwatchInterval) {
                    resetStopwatch();
                } else {
                    startStopwatch();
                }
            } else if (e.key === '+') {
                if (!stopwatchInterval) {
                    incrementHeat();  
                }
            } else if (e.key === '*') {
                if (!stopwatchInterval) {
                    incrementEvent();
                    
                }
            }
        });
    }

    if (isScreenPage) {
        fetchCompetitionData(1, 1); // Initial fetch for event 1 and heat 1
    }

    if (isRemotePage) {
        eventSelect.addEventListener('change', () => {
            fetchCompetitionData(eventSelect.value, heatSelect.value);
        });

        heatSelect.addEventListener('change', () => {
            fetchCompetitionData(eventSelect.value, heatSelect.value);
        });
    }

    function clearLaneInformation() {
        for (let i = 0; i <= 9; i++) {
            const laneElement = document.getElementById(`lane-${i}`);
            laneElement.querySelector('.athlete').textContent = '';
            laneElement.querySelector('.club').textContent = '';
            laneElement.querySelector('.split-time').textContent = '---:---:---';
        }
    }

    function fetchCompetitionData(event, heat) {
        fetch(`/competition/events-list?event=${event}&heat=${heat}`)
            .then(response => response.json())
            .then(data => {
                updateLaneInformation(data.entries);
                if (swimStyleElement) {
                    swimStyleElement.textContent = data.event.swimstyle;
                }
            })
            .catch(error => {
                clearLaneInformation();
                console.error('Error fetching competition data:', error.message);
            });
    }

    function updateLaneInformation(entries) {
        clearLaneInformation()
        entries.forEach(entry => {
            entry.forEach(athlete => {
                const laneElement = document.getElementById(`lane-${athlete.lane}`);
                laneElement.querySelector('.club').textContent = athlete.club;
                laneElement.querySelector('.split-time').textContent = '---:---:---';

                if (athlete.athletes && athlete.athletes.length > 0) {
                    //if has multiple athletes, show only the first 3 characters of the first name
                    let athleteNames = '';
                    athlete.athletes.forEach((a, index) => {
                        athleteNames += `${a.firstname.substring(0, 3)}..`;
                        if (index < athlete.athletes.length - 1) {
                            athleteNames += ' / ';
                        }
                    });
                    laneElement.querySelector('.athlete').textContent = athleteNames;
                } else {
                    laneElement.querySelector('.athlete').textContent = `${athlete.firstname} ${athlete.lastname}`;
                }
            });

        });
    }

    function startConnectionCheck() {
        connectionCheckInterval = setInterval(() => {
            console.log('Checking connection status...');
            if (socket.readyState !== WebSocket.OPEN || !navigator.onLine) {
                connectionIndicator.classList.remove('bg-green-500');
                connectionIndicator.classList.add('bg-red-500');
                connectWebSocket();
            }
        }, 2000);
    }

    function stopConnectionCheck() {
        clearInterval(connectionCheckInterval);
    }
});
