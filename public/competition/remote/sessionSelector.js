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
  const sessionLabel = document.getElementById('session-label');

  function updateSessionIndicator() {
    if (!currentSession) return;
    if (sessionIndicator) sessionIndicator.textContent = String(currentSession);
    if (sessionLabel) sessionLabel.textContent = `Session ${currentSession}`;
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
          'cursor-pointer rounded-lg px-4 py-2 transition-colors hover:bg-pool-700';

        const sessionTime = session.daytime ? ` ${session.daytime}` : '';

        // Build labels with textContent so competition-data fields
        // (date, daytime) can never be parsed as markup.
        const wrapper = document.createElement('div');
        wrapper.className = 'text-left';
        const title = document.createElement('div');
        title.className = 'font-bold';
        title.textContent = `Session ${session.number}`;
        const subtitle = document.createElement('div');
        subtitle.className = 'text-sm text-pool-300';
        subtitle.textContent = `${session.date}${sessionTime}`;
        wrapper.append(title, subtitle);
        listItem.appendChild(wrapper);
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

  return loadSessions();
}
