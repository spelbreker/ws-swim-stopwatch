// Session selector logic for the competition remote.
// Handles loading sessions from the API, displaying a session dialog,
// and switching the current session.
//
// Exports:
//   initSessionSelector({ onSessionChanged })
//   getCurrentSession()
//   setCurrentSession(sessionNumber)

let currentSession = null;

/** @returns {number|null} */
export function getCurrentSession() {
  return currentSession;
}

/** @param {number} sessionNumber */
export function setCurrentSession(sessionNumber) {
  currentSession = sessionNumber;
}

/**
 * Initialize the session selector dialog.
 * @param {Object} opts
 * @param {function} opts.onSessionChanged - Called with (sessionNumber) when session changes
 */
export function initSessionSelector({ onSessionChanged }) {
  const sessionMenuButton = document.getElementById('session-menu-button');
  const sessionDialog = document.getElementById('session-dialog');
  const sessionList = document.getElementById('session-list');
  const closeSessionDialog = document.getElementById('close-session-dialog');
  const sessionIndicator = document.getElementById('session-indicator');

  function updateSessionIndicator() {
    if (sessionIndicator && currentSession) {
      sessionIndicator.textContent = `Session ${currentSession}`;
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch('/competition/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const sessions = await res.json();

      sessionList.innerHTML = '';
      sessions.forEach((session) => {
        const listItem = document.createElement('li');
        listItem.className =
          'cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors';

        const sessionTime = session.daytime ? ` ${session.daytime}` : '';

        listItem.innerHTML = `
          <div class="text-left">
            <div class="font-medium text-gray-900 dark:text-gray-100">Session ${session.number}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">${session.date}${sessionTime}</div>
          </div>
        `;
        listItem.addEventListener('click', () => selectSession(session.number));
        sessionList.appendChild(listItem);
      });

      if (!currentSession && sessions.length > 0) {
        currentSession = sessions[0].number;
        updateSessionIndicator();
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      if (!currentSession) {
        currentSession = 1;
        updateSessionIndicator();
      }
    }
  }

  function selectSession(sessionNumber) {
    currentSession = sessionNumber;
    updateSessionIndicator();
    if (sessionDialog) sessionDialog.classList.add('hidden');
    if (onSessionChanged) onSessionChanged(sessionNumber);
  }

  if (sessionMenuButton) {
    sessionMenuButton.addEventListener('click', () => {
      sessionDialog.classList.remove('hidden');
    });
  }

  if (closeSessionDialog) {
    closeSessionDialog.addEventListener('click', () => {
      sessionDialog.classList.add('hidden');
    });
  }

  if (sessionDialog) {
    sessionDialog.addEventListener('click', (e) => {
      if (e.target === sessionDialog) {
        sessionDialog.classList.add('hidden');
      }
    });
  }

  loadSessions();
}
