// Device management page logic.
// Migrated from IIFE to ES module. Uses shared socket.js instead of own WebSocket.
// Replaces window.editDevice + onclick in innerHTML with event delegation.

import { onSocketEvent, send } from '../js/modules/socket.js';

let devices = [];

// DOM elements
const wsStatus = document.getElementById('wsStatus');
const wsStatusIndicator = document.getElementById('wsStatusIndicator');
const deviceCount = document.getElementById('deviceCount');
const devicesTableBody = document.getElementById('devicesTableBody');
const emptyState = document.getElementById('emptyState');
const editModal = document.getElementById('editModal');
const editMac = document.getElementById('editMac');
const editMacDisplay = document.getElementById('editMacDisplay');
const editRole = document.getElementById('editRole');
const editLane = document.getElementById('editLane');
const cancelEdit = document.getElementById('cancelEdit');
const saveEdit = document.getElementById('saveEdit');

// Track the device currently being edited
let editingMac = null;

// WebSocket event handler
onSocketEvent((event) => {
  if (event === 'open') {
    updateConnectionStatus(true);
    loadDevices();
  } else if (event === 'close') {
    updateConnectionStatus(false);
  }
});

// Handle device-related messages
onSocketEvent((event, socket, data) => {
  if (event !== 'message') return;
  if (data.type === 'device_register' || data.type === 'device_update_role' || data.type === 'device_update_lane') {
    loadDevices();
  }
});

function updateConnectionStatus(connected) {
  if (connected) {
    wsStatus.textContent = 'Connected';
    wsStatusIndicator.className = 'h-3 w-3 rounded-full bg-green-500 mr-2';
  } else {
    wsStatus.textContent = 'Disconnected';
    wsStatusIndicator.className = 'h-3 w-3 rounded-full bg-red-500 mr-2';
  }
}

// Load devices from API
async function loadDevices() {
  try {
    const response = await fetch('/devices');
    const data = await response.json();
    devices = data.devices || [];
    renderDevices();
  } catch (error) {
    console.error('[Devices] Failed to load devices:', error);
  }
}

// Render devices table using event delegation instead of onclick
function renderDevices() {
  deviceCount.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;

  if (devices.length === 0) {
    devicesTableBody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  devicesTableBody.innerHTML = devices
    .map((device) => {
      const statusClass = device.connected ? 'bg-green-500' : 'bg-gray-400';
      const statusText = device.connected ? 'Connected' : 'Disconnected';
      const lastSeen = new Date(device.lastSeen).toLocaleString();
      const laneDisplay = device.lane !== undefined ? device.lane : '-';

      return `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <div class="h-2 w-2 rounded-full ${statusClass} mr-2"></div>
              <span class="text-sm text-gray-900 dark:text-white">${statusText}</span>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">${device.mac}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${device.ip}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${device.role === 'starter' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'}">
              ${device.role}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${laneDisplay}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${lastSeen}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">
            <button data-edit-mac="${device.mac}" class="text-cyan-600 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 font-medium">
              Edit
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

// Event delegation for edit buttons
devicesTableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit-mac]');
  if (editBtn) {
    openEditModal(editBtn.getAttribute('data-edit-mac'));
  }
});

// Toggle lane field based on role
function updateLaneFieldState() {
  const isStarter = editRole.value === 'starter';
  editLane.disabled = isStarter;
  if (isStarter) {
    editLane.value = '';
  }
}

// Open edit modal for a device
function openEditModal(mac) {
  const device = devices.find((d) => d.mac === mac);
  if (!device) return;

  editingMac = mac;
  editMac.value = device.mac;
  editMacDisplay.textContent = device.mac;
  editRole.value = device.role;
  editLane.value = device.lane !== undefined ? device.lane : '';

  updateLaneFieldState();

  editModal.classList.remove('hidden');
  editModal.classList.add('flex');
}

function closeEditModal() {
  editingMac = null;
  editModal.classList.add('hidden');
  editModal.classList.remove('flex');
}

// Save device changes
async function saveDeviceChanges() {
  const mac = editingMac;
  if (!mac) return;

  const newRole = editRole.value;
  const newLane = newRole === 'lane' && editLane.value ? parseInt(editLane.value, 10) : undefined;

  const device = devices.find((d) => d.mac === mac);
  if (!device) return;

  // Send role update if changed
  if (device.role !== newRole) {
    send({ type: 'device_update_role', mac, role: newRole });
  }

  // Send lane update if changed (only for lane role)
  if (newRole === 'lane' && device.lane !== newLane) {
    send({ type: 'device_update_lane', mac, lane: newLane });
  }

  // Clear lane if role changed to starter
  if (newRole === 'starter' && device.lane !== undefined) {
    send({ type: 'device_update_lane', mac, lane: undefined });
  }

  closeEditModal();

  // Reload devices after a short delay to reflect changes
  setTimeout(() => loadDevices(), 500);
}

// Event listeners
editRole.addEventListener('change', updateLaneFieldState);
cancelEdit.addEventListener('click', closeEditModal);
saveEdit.addEventListener('click', saveDeviceChanges);

// Close modal on background click
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

// Initialize on page load
loadDevices();

// Refresh devices list every 10 seconds
setInterval(loadDevices, 10000);
