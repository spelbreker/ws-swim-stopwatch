document.addEventListener('DOMContentLoaded', function () {
    // Add stopwatch elements
    let stopwatchInterval;
    let startTime;
    const stopwatchElement = document.getElementById('stopwatch');
    
    // Get elements
    const startButton = document.getElementById('start-button');
    const resetButton = document.getElementById('reset-button');
    const clearScreenButton = document.getElementById('clear-screen');
    const incrementEventButton = document.getElementById('increment-event');
    const incrementHeatButton = document.getElementById('increment-heat');
    const eventSelect = document.getElementById('event-select');
    const heatSelect = document.getElementById('heat-select');
    const laneButtons = document.querySelectorAll('.lane-button');

    function startStopwatch(sendSocket = true) {
        startTime = Date.now();
        stopwatchInterval = setInterval(updateStopwatch, 10);
        resetSplitTimes();
        if (sendSocket) {
            window.socket.send(JSON.stringify({ type: 'start', time: startTime }));
        }
        disableControls(true);
    }

    function resetStopwatch(sendSocket = true) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        stopwatchElement.textContent = '00:00:00';
        if (sendSocket) {
            window.socket.send(JSON.stringify({ type: 'reset' }));
        }
        disableControls(false);
    }

    function updateStopwatch() {
        const elapsedTime = Date.now() - startTime;
        const minutes = Math.floor(elapsedTime / 60000);
        const seconds = Math.floor((elapsedTime % 60000) / 1000);
        const milliseconds = Math.floor((elapsedTime % 1000) / 10);
        stopwatchElement.textContent = 
            `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds)}`;
    }

    function pad(number) {
        return number.toString().padStart(2, '0');
    }

    function disableControls(disable) {
        // Disable event and heat controls during timing
        eventSelect.disabled = disable;
        heatSelect.disabled = disable;
        incrementEventButton.disabled = disable;
        incrementHeatButton.disabled = disable;
        startButton.disabled = disable;
        
        const classAction = disable ? 'add' : 'remove';
        [eventSelect, heatSelect, incrementEventButton, incrementHeatButton, startButton].forEach(element => {
            element.classList[classAction]('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        });
    }

    // Event listeners
    clearScreenButton.addEventListener('click', () => {
        window.socket.send(JSON.stringify({ type: 'clear' }));
    });
    
    startButton.addEventListener('click', () => startStopwatch());
    resetButton.addEventListener('click', () => resetStopwatch());
    incrementEventButton.addEventListener('click', incrementEvent);
    incrementHeatButton.addEventListener('click', incrementHeat);
    
    eventSelect.addEventListener('change', () => {
        heatSelect.value = 1;
        sendProgramAndHeat(eventSelect.value, 1);
        fetchCompetitionData(eventSelect.value, heatSelect.value);
    });
    
    heatSelect.addEventListener('change', () => {
        sendProgramAndHeat(eventSelect.value, heatSelect.value);
        fetchCompetitionData(eventSelect.value, heatSelect.value);
    });

    // Lane button handlers
    laneButtons.forEach(button => {
        button.addEventListener('click', () => {
            const lane = button.getAttribute('data-lane');
            const time = stopwatchElement.textContent;
            new Promise((resolve) => {
                window.socket.send(JSON.stringify({ type: 'split', lane, time }));
                document.getElementById(`lane-${lane}`).querySelector('.split-time').textContent = time;
            });
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

    function fillSelectOptions(selectElement, maxValue) {
        if (!selectElement) return;
        for (let i = 1; i <= maxValue; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            selectElement.appendChild(option);
        }
    }

    // Move initialization to after WebSocket connection is established
    window.socket.addEventListener('open', function() {
        // Initialize select options after WebSocket is connected
        fillSelectOptions(eventSelect, 50);
        fillSelectOptions(heatSelect, 20);
    });

    // Remove or comment out the original initialization
    // window.fillSelectOptions(eventSelect, 50);
    // window.fillSelectOptions(heatSelect, 20);

    function highlightLaneButton(button) {
        button.classList.add('bg-green-500');
        button.classList.remove('bg-blue-500');
        setTimeout(() => {
            button.classList.remove('bg-green-500');
            button.classList.add('bg-blue-500');
        }, 10000);
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

    function sendProgramAndHeat(event, heat) {
        window.socket.send(JSON.stringify({ type: 'event-heat', event: event, heat: heat }));
    }

    // Add WebSocket message handler
    window.socket.addEventListener('message', function (event) {
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
            eventSelect.value = message.event;
            heatSelect.value = message.heat;
            fetchCompetitionData(message.event, message.heat);
            resetSplitTimes();
        } else if (message.type === 'clear') {
            clearLaneInformation();
        }
    });
});

// Add these functions outside the DOMContentLoaded event listener
function resetSplitTimes() {
    document.querySelectorAll('.split-time').forEach(element => {
        element.textContent = '--:--:--';
    });
}

function clearLaneInformation() {
    document.querySelectorAll('.lane-button').forEach(button => {
        const lane = button.getAttribute('data-lane');
        document.getElementById(`lane-${lane}`).querySelector('.split-time').textContent = '--:--:--';
        button.classList.remove('bg-green-500');
        button.classList.add('bg-blue-500');
    });
}
