// Training interval timer logic.
// Migrated to ES module. Uses shared socket.js instead of own WebSocket.
// Replaces window.startInterval / window.deleteInterval + onclick in innerHTML
// with event delegation.

import { send, onSocketEvent } from '../js/modules/socket.js';

const isRemotePage = window.location.pathname.includes('training-remote.html');
const isScreenPage = window.location.pathname.includes('training-screen.html');

let intervals = [];

function generateUID() {
  return '_' + Math.random().toString(36).substring(2, 11);
}

// WebSocket message handler
onSocketEvent((event, socket, message) => {
  if (event !== 'message') return;

  if (message.type === 'start-interval') {
    updateInterval(message.uid, message.interval);
    if (isScreenPage) {
      startInterval(message.uid, false);
    }
  } else if (message.type === 'add-interval') {
    intervals.push(message.newInterval);
    renderTable();
  } else if (message.type === 'delete-interval') {
    const index = intervals.findIndex((int) => int.uid === message.uid);
    if (index !== -1) {
      clearInterval(intervals[index].intervalTimer);
      intervals.splice(index, 1);
      renderTable();
    }
  }
});

function updateInterval(uid, updatedInterval) {
  const index = intervals.findIndex((int) => int.uid === uid);
  if (index !== -1) {
    intervals[index] = updatedInterval;
    renderTable();
  }
}

function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const el = document.getElementById('current-time');
  if (el) el.textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateTime, 1000);
updateTime();

function addInterval() {
  const title = document.getElementById('title').value;
  const repetitions = parseInt(document.getElementById('repetitions').value, 10);
  const minutes = parseInt(document.getElementById('minutes').value, 10);
  const seconds = parseInt(document.getElementById('seconds').value, 10);
  const uid = generateUID();

  const newInterval = {
    uid,
    title,
    repetitions,
    currentRepetion: 0,
    currentMinutes: minutes,
    currentSeconds: seconds,
    minutes,
    seconds,
    intervalTimer: null,
  };

  intervals.push(newInterval);
  send({ type: 'add-interval', newInterval });
  renderTable();
}

function renderTable() {
  const tableBody = document.getElementById('training-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  intervals.forEach((int) => {
    const row = document.createElement('tr');
    row.classList.add('border-b', 'border-gray-300');
    if (int.currentMinutes === 0 && int.currentSeconds === 0) {
      row.classList.add('bg-red-200');
    }
    if (int.currentRepetion === int.repetitions) {
      row.classList.add('bg-green-200');
    }
    row.id = `interval-${int.uid}`;
    row.innerHTML = `
      <td>${int.title}</td>
      <td>${int.currentRepetion}/${int.repetitions}</td>
      <td>${String(int.currentMinutes).padStart(2, '0')}:${String(int.currentSeconds).padStart(2, '0')}</td>
      <td>
        ${
          isRemotePage
            ? `<button class="start-pause bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2" data-action="start" data-uid="${int.uid}">Start</button>
               <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded m-2" data-action="delete" data-uid="${int.uid}">Delete</button>`
            : ''
        }
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// Event delegation for start/delete buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const uid = btn.getAttribute('data-uid');
  if (action === 'start') {
    startInterval(uid, true);
  } else if (action === 'delete') {
    deleteInterval(uid);
  }
});

function startInterval(uid, sendSocket = false) {
  const index = intervals.findIndex((int) => int.uid === uid);
  if (index === -1) return;

  const int = intervals[index];
  if (int.currentRepetion >= int.repetitions) {
    int.currentRepetion = 0;
    int.currentMinutes = int.minutes;
    int.currentSeconds = int.seconds;
  }
  int.intervalTimer = setInterval(() => {
    if (int.currentRepetion >= int.repetitions) {
      clearInterval(int.intervalTimer);
      return;
    }
    if (int.currentSeconds === 0) {
      if (int.currentMinutes === 0) {
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
    intervals[index] = int;
    renderTable();
  }, 1000);
  if (sendSocket) {
    send({ type: 'start-interval', uid, interval: int });
  }
}

function deleteInterval(uid) {
  const index = intervals.findIndex((int) => int.uid === uid);
  if (index === -1) return;

  clearInterval(intervals[index].intervalTimer);
  intervals.splice(index, 1);
  send({ type: 'delete-interval', uid });
  renderTable();
}

function renderSelects() {
  const minutesSelect = document.getElementById('minutes');
  const secondsSelect = document.getElementById('seconds');
  if (!minutesSelect || !secondsSelect) return;

  for (let i = 0; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = String(i).padStart(2, '0');
    minutesSelect.appendChild(option);
  }

  for (let i = 0; i <= 60; i += 5) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = String(i).padStart(2, '0');
    secondsSelect.appendChild(option);
  }
}

// Initialize
renderSelects();
renderTable();
if (isRemotePage) {
  const addRowBtn = document.getElementById('add-row');
  if (addRowBtn) addRowBtn.addEventListener('click', addInterval);
}
