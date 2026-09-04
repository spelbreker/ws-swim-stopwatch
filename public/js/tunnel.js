// Cloudflare Tunnel admin page logic.
// Extracted from inline <script> in tunnel.html.

let refreshInterval;

// Toast notification system
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const content = document.getElementById('toastContent');

  const colors = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
    warning: 'bg-yellow-500 text-black',
  };

  content.className = `px-6 py-4 rounded-lg shadow-lg max-w-sm ${colors[type] || colors.info}`;
  content.textContent = message;

  toast.classList.remove('translate-y-full', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-full', 'opacity-0');
  }, 4000);
}

async function fetchStatus() {
  try {
    const response = await fetch('/tunnel/status');
    const status = await response.json();
    updateUI(status);
  } catch (error) {
    console.error('Failed to fetch status:', error);
    updateUI({ running: false, error: 'Failed to connect to server' });
  }
}

function updateUI(status) {
  const statusBadge = document.getElementById('statusBadge');
  const statusDetails = document.getElementById('statusDetails');
  const errorMessage = document.getElementById('errorMessage');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const autoStartCheckbox = document.getElementById('autoStart');
  const allowAllRoutesCheckbox = document.getElementById('allowAllRoutes');

  if (status.running) {
    statusBadge.textContent = 'Running';
    statusBadge.className = 'px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400';
  } else {
    statusBadge.textContent = 'Stopped';
    statusBadge.className = 'px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400';
  }

  let detailsHtml = '';
  if (status.pid) {
    detailsHtml += `<p><strong>Process ID:</strong> ${status.pid}</p>`;
  }
  if (status.token) {
    detailsHtml += `<p><strong>Token:</strong> ${status.token}</p>`;
  } else {
    detailsHtml += `<p><strong>Token:</strong> <span class="text-yellow-600 dark:text-yellow-400">Not configured</span></p>`;
  }

  if (status.url) {
    detailsHtml += `<p><strong>Tunnel URL:</strong> <a href="${status.url}" target="_blank" rel="noopener" class="text-cyan-600 dark:text-cyan-400 hover:underline break-all">${status.url}</a></p>`;
  }

  if (status.connectionInfo) {
    detailsHtml += `<p><strong>Connection ID:</strong> <code class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">${status.connectionInfo.id}</code></p>`;
    detailsHtml += `<p><strong>Connection IP:</strong> ${status.connectionInfo.ip}</p>`;
    detailsHtml += `<p><strong>Location:</strong> ${status.connectionInfo.location}</p>`;
  }

  detailsHtml += `<p><strong>Auto-start:</strong> ${status.autoStart ? 'Enabled' : 'Disabled'}</p>`;
  detailsHtml += `<p><strong>Route restrictions:</strong> ${status.allowAllRoutes ? '<span class="text-yellow-600 dark:text-yellow-400">Disabled (All routes accessible)</span>' : 'Enabled (Restricted mode)'}</p>`;
  statusDetails.innerHTML = detailsHtml;

  if (status.error) {
    errorMessage.textContent = status.error;
    errorMessage.classList.remove('hidden');
  } else {
    errorMessage.classList.add('hidden');
  }

  startBtn.disabled = status.running;
  stopBtn.disabled = !status.running;

  autoStartCheckbox.checked = status.autoStart;
  allowAllRoutesCheckbox.checked = status.allowAllRoutes;
}

async function startTunnel() {
  const token = document.getElementById('token').value;
  try {
    const response = await fetch('/tunnel/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token || undefined }),
    });
    const result = await response.json();
    if (result.success) {
      showToast('Tunnel started successfully', 'success');
    } else {
      showToast('Failed to start tunnel: ' + result.error, 'error');
    }
    fetchStatus();
  } catch (error) {
    showToast('Failed to start tunnel: ' + error.message, 'error');
  }
}

async function stopTunnel() {
  try {
    const response = await fetch('/tunnel/stop', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      showToast('Tunnel stopped', 'success');
    } else {
      showToast('Failed to stop tunnel: ' + result.error, 'error');
    }
    fetchStatus();
  } catch (error) {
    showToast('Failed to stop tunnel: ' + error.message, 'error');
  }
}

async function saveConfig(event) {
  event.preventDefault();
  const token = document.getElementById('token').value;
  const autoStart = document.getElementById('autoStart').checked;
  const allowAllRoutes = document.getElementById('allowAllRoutes').checked;

  if (!token) {
    showToast('Please enter a tunnel token', 'warning');
    return;
  }

  try {
    const response = await fetch('/tunnel/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, autoStart, allowAllRoutes }),
    });
    const result = await response.json();
    if (result.success) {
      showToast('Configuration saved successfully', 'success');
      document.getElementById('token').value = '';
      fetchStatus();
    } else {
      showToast('Failed to save configuration: ' + result.error, 'error');
    }
  } catch (error) {
    showToast('Failed to save configuration: ' + error.message, 'error');
  }
}

async function updateSetting(settingName) {
  const checkbox = document.getElementById(settingName);
  const value = checkbox.checked;

  try {
    const response = await fetch('/tunnel/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [settingName]: value }),
    });
    const result = await response.json();
    if (result.success) {
      showToast('Setting updated', 'success');
      fetchStatus();
    } else {
      checkbox.checked = !value;
      showToast('Failed to update setting: ' + result.error, 'error');
    }
  } catch (error) {
    checkbox.checked = !value;
    showToast('Failed to update setting: ' + error.message, 'error');
  }
}

async function deleteConfig() {
  if (!confirm('Are you sure you want to delete the tunnel configuration?')) return;

  try {
    const response = await fetch('/tunnel/config', { method: 'DELETE' });
    const result = await response.json();
    if (result.success) {
      showToast('Configuration deleted', 'success');
      fetchStatus();
    } else {
      showToast('Failed to delete configuration: ' + result.error, 'error');
    }
  } catch (error) {
    showToast('Failed to delete configuration: ' + error.message, 'error');
  }
}

// Wire up event listeners
document.getElementById('startBtn').addEventListener('click', startTunnel);
document.getElementById('stopBtn').addEventListener('click', stopTunnel);
document.getElementById('configForm').addEventListener('submit', saveConfig);
document.getElementById('autoStart').addEventListener('change', () => updateSetting('autoStart'));
document.getElementById('allowAllRoutes').addEventListener('change', () => updateSetting('allowAllRoutes'));
document.getElementById('deleteConfigBtn').addEventListener('click', deleteConfig);

// Stop polling when page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(refreshInterval);
  } else {
    fetchStatus();
    refreshInterval = setInterval(fetchStatus, 5000);
  }
});

// Initial fetch and start polling
fetchStatus();
refreshInterval = setInterval(fetchStatus, 5000);
