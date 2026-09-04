// Competition log viewer.
// Extracted from inline <script> in log.html.

async function fetchLog() {
  const logContent = document.getElementById('log-content');
  if (!logContent) return;
  try {
    const res = await fetch('/logs/competition.log', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load log file (status: ${res.status})`);
    const text = await res.text();
    logContent.textContent = text.trim() || 'Log file is empty.';
  } catch (e) {
    logContent.textContent = `Error loading log: ${e.message}`;
  }
}

document.getElementById('refresh-btn').addEventListener('click', fetchLog);
window.addEventListener('DOMContentLoaded', fetchLog);
// Auto-refresh every 10 seconds
setInterval(fetchLog, 10000);
