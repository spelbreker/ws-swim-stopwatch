// Device management page logic
(function() {
    'use strict';

    let ws = null;
    let devices = [];
    let reconnectInterval = null;

    // DOM elements
    const wsStatus = document.getElementById('wsStatus');
    const wsStatusIndicator = document.getElementById('wsStatusIndicator');
    const deviceCount = document.getElementById('deviceCount');
    const devicesTableBody = document.getElementById('devicesTableBody');
    const emptyState = document.getElementById('emptyState');
    const editModal = document.getElementById('editModal');
    const editMac = document.getElementById('editMac');
    const editRole = document.getElementById('editRole');
    const editLane = document.getElementById('editLane');
    const cancelEdit = document.getElementById('cancelEdit');
    const saveEdit = document.getElementById('saveEdit');

    // Initialize WebSocket connection
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        ws = new WebSocket(wsUrl);

        ws.addEventListener('open', () => {
            console.log('[WebSocket] Connected');
            updateConnectionStatus(true);
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            loadDevices();
        });

        ws.addEventListener('close', () => {
            console.log('[WebSocket] Disconnected');
            updateConnectionStatus(false);
            
            if (!reconnectInterval) {
                reconnectInterval = setInterval(() => {
                    console.log('[WebSocket] Attempting to reconnect...');
                    connectWebSocket();
                }, 5000);
            }
        });

        ws.addEventListener('error', (error) => {
            console.error('[WebSocket] Error:', error);
        });

        ws.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('[WebSocket] Failed to parse message:', error);
            }
        });
    }

    // Handle WebSocket messages
    function handleWebSocketMessage(data) {
        if (data.type === 'device_update_role' || data.type === 'device_update_lane') {
            // Reload devices when updates occur
            loadDevices();
        }
    }

    // Update connection status display
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

    // Render devices table
    function renderDevices() {
        deviceCount.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;

        if (devices.length === 0) {
            devicesTableBody.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            devicesTableBody.innerHTML = devices.map(device => {
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
                            <button onclick="window.editDevice('${device.mac}')" class="text-cyan-600 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 font-medium">
                                Edit
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Open edit modal for a device
    window.editDevice = function(mac) {
        const device = devices.find(d => d.mac === mac);
        if (!device) return;

        editMac.value = device.mac;
        editRole.value = device.role;
        editLane.value = device.lane !== undefined ? device.lane : '';

        editModal.classList.remove('hidden');
        editModal.classList.add('flex');
    };

    // Close edit modal
    function closeEditModal() {
        editModal.classList.add('hidden');
        editModal.classList.remove('flex');
    }

    // Save device changes
    async function saveDeviceChanges() {
        const mac = editMac.value;
        const newRole = editRole.value;
        const newLane = editLane.value ? parseInt(editLane.value, 10) : undefined;

        const device = devices.find(d => d.mac === mac);
        if (!device) return;

        // Send role update if changed
        if (device.role !== newRole) {
            const roleMsg = {
                type: 'device_update_role',
                mac: mac,
                role: newRole
            };
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(roleMsg));
            }
        }

        // Send lane update if changed
        if (device.lane !== newLane) {
            const laneMsg = {
                type: 'device_update_lane',
                mac: mac,
                lane: newLane
            };
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(laneMsg));
            }
        }

        closeEditModal();
        
        // Reload devices after a short delay to reflect changes
        setTimeout(() => loadDevices(), 500);
    }

    // Event listeners
    cancelEdit.addEventListener('click', closeEditModal);
    saveEdit.addEventListener('click', saveDeviceChanges);

    // Close modal on background click
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    // Initialize on page load
    connectWebSocket();
    loadDevices();

    // Refresh devices list every 10 seconds
    setInterval(loadDevices, 10000);
})();
