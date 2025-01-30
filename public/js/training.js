document.addEventListener('DOMContentLoaded', function () {
    const isRemotePage = window.location.pathname.includes('training-remote.html');
    const isScreenPage = window.location.pathname.includes('training-screen.html');

    let socket;
    let interval = [];

    function generateUID() {
        return '_' + Math.random().toString(36).substring(2, 11);
    }

    function connectWebSocket() {
        socket = new WebSocket(`${window.location.origin.replace(/^http/, 'ws')}`);

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
                updateInterval(message.uid, message.interval);
                if (isScreenPage) {
                    startInterval(message.uid, false);
                }
            } else if (message.type === 'add-interval') {
                interval.push(message.newInterval);
                renderTable();
            } else if (message.type === 'delete-interval') {
                const index = interval.findIndex(int => int.uid === message.uid);
                if (index !== -1) {
                    clearInterval(interval[index].intervalTimer);
                    interval.splice(index, 1);
                    renderTable();
                }
            }
        });
    }

    connectWebSocket();

    function updateInterval(uid, updatedInterval) {
        const index = interval.findIndex(int => int.uid === uid);
        if (index !== -1) {
            interval[index] = updatedInterval;
            renderTable();
        }
    }

    function updateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('current-time').textContent = `${hours}:${minutes}:${seconds}`;
    }
    setInterval(updateTime, 1000);
    updateTime();

    function addInterval(){
        const title = document.getElementById('title').value;
        const repetitions = parseInt(document.getElementById('repetitions').value);
        const minutes = parseInt(document.getElementById('minutes').value);
        const seconds = parseInt(document.getElementById('seconds').value);
        const uid = generateUID();

        let newInterval = {uid, title, repetitions: repetitions, currentRepetion:0, currentMinutes:minutes, currentSeconds:seconds, minutes:minutes, seconds:seconds, intervalTimer: null}

        interval.push(newInterval);
        socket.send(JSON.stringify({ type: 'add-interval', newInterval }));
        renderTable();
    }

    function renderTable(){
        console.log(interval);
        const tableBody = document.getElementById('training-table-body');
        tableBody.innerHTML = '';
        interval.forEach((int) => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-gray-300');
            if(int.currentMinutes === 0 && int.currentSeconds === 0){
                row.classList.add('bg-red-200');
            }
            if(int.currentRepetion == int.repetitions){
                row.classList.add('bg-green-200');
            }
            row.id = `interval-${int.uid}`;
            row.innerHTML = `
                <td>${int.title}</td>
                <td>${int.currentRepetion}/${int.repetitions}</td>
                <td>${String(int.currentMinutes).padStart(2, '0')}:${String(int.currentSeconds).padStart(2, '0')}</td>
                <td>
                    ${isRemotePage ? `<button class="start-pause bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2" onclick="startInterval('${int.uid}', true)">Start</button>
                    <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded m-2" onclick="deleteInterval('${int.uid}')">Delete</button>` : ''}
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function startInterval(uid, sendSocket = false){
        const index = interval.findIndex(int => int.uid === uid);
        if (index === -1) return;

        const int = interval[index];
        if (int.currentRepetion >= int.repetitions) {
            int.currentRepetion = 0;
            int.currentMinutes = int.minutes;
            int.currentSeconds = int.seconds;
        }
        int.intervalTimer = setInterval(() => {
            if(int.currentRepetion >= int.repetitions){
                clearInterval(int.intervalTimer);
                return;
            }
            if(int.currentSeconds === 0){
                if(int.currentMinutes === 0){
                    int.currentRepetion++;
                    int.currentMinutes = int.minutes;
                    int.currentSeconds = int.seconds;
                
                } else {
                    int.currentMinutes--;
                    int.currentSeconds = 59;
                }
            } else {
                int.currentSeconds--;
            }
            interval[index] = int; // Save the interval object in the array
            renderTable();
        }, 1000);
        if (sendSocket) {
            socket.send(JSON.stringify({ type: 'start-interval', uid, interval: int }));
        }
    }

    function deleteInterval(uid){
        const index = interval.findIndex(int => int.uid === uid);
        if (index === -1) return;

        clearInterval(interval[index].intervalTimer);
        interval.splice(index, 1);
        socket.send(JSON.stringify({ type: 'delete-interval', uid }));
        renderTable();
    }

    function renderSelects(){
        const minutesSelect = document.getElementById('minutes');
        const secondsSelect = document.getElementById('seconds');

        for(let i = 0; i <= 30; i++){
            const option = document.createElement('option');
            option.value = i;
            option.textContent = String(i).padStart(2, '0');
            minutesSelect.appendChild(option);
        }

        for(let i = 0; i <= 60; i+=5){
            const option = document.createElement('option');
            option.value = i;
            option.textContent = String(i).padStart(2, '0');
            secondsSelect.appendChild(option);
        }
    }

    renderSelects();
    renderTable();
    if (isRemotePage) {
        document.getElementById('add-row').addEventListener('click', addInterval);
    }

    window.startInterval = startInterval;
    window.deleteInterval = deleteInterval;
});
