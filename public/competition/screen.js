document.addEventListener('DOMContentLoaded', function () {
    let stopwatchInterval;
    let startTime;
    const stopwatchElement = document.getElementById('stopwatch');

    // Initialize with first event and heat
    window.fetchCompetitionData(1, 1);

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

    // Add WebSocket message handler for screen updates
    window.socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);
        if (message.type === 'start') {
            startTime = message.time;
            stopwatchInterval = setInterval(updateStopwatch, 10);
        } else if (message.type === 'reset') {
            clearInterval(stopwatchInterval);
            stopwatchInterval = null;
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
            window.fetchCompetitionData(message.event, message.heat);
        } else if (message.type === 'clear') {
            window.clearLaneInformation();
        }
    });
});
