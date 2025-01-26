document.addEventListener('DOMContentLoaded', function () {
    const isRemotePage = window.location.pathname.includes('training-remote.html');
    const isScreenPage = window.location.pathname.includes('training-screen.html');

    let socket;

    function connectWebSocket() {
        socket = new WebSocket(`ws://${window.location.hostname}:8080`);

        socket.addEventListener('open', function () {
            console.log('WebSocket connection established');
        });

        socket.addEventListener('close', function () {
            console.log('WebSocket connection closed, attempting to reconnect...');
            setTimeout(connectWebSocket, 1000);
        });

        socket.addEventListener('message', function (event) {
            const message = JSON.parse(event.data);
            if (message.type === 'start-interval') {
                updateInterval(message.index, message.interval);
            }
        });
    }

    connectWebSocket();

    function updateInterval(index, interval) {
        const row = document.getElementById(`interval-${index}`);
        if (row) {
            row.querySelector('td:nth-child(2)').textContent = `${interval.currentRepetion}/${interval.repetitions}`;
            row.querySelector('td:nth-child(3)').textContent = `${String(interval.currentMinutes).padStart(2, '0')}:${String(interval.currentSeconds).padStart(2, '0')}`;
        }
    }

    if (isRemotePage) {
        const addRowButton = document.getElementById('add-row');
        addRowButton.addEventListener('click', function () {
            const title = document.getElementById('title').value;
            const repetitions = parseInt(document.getElementById('repetitions').value);
            const minutes = parseInt(document.getElementById('minutes').value);
            const seconds = parseInt(document.getElementById('seconds').value);

            const interval = { title, repetitions, currentRepetion: 0, currentMinutes: minutes, currentSeconds: seconds, minutes, seconds };
            socket.send(JSON.stringify({ type: 'add-interval', interval }));
        });

        window.startInterval = function (index) {
            socket.send(JSON.stringify({ type: 'start-interval', index }));
        };

        window.deleteInterval = function (index) {
            socket.send(JSON.stringify({ type: 'delete-interval', index }));
        };
    }
});
