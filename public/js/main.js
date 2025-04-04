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
});
