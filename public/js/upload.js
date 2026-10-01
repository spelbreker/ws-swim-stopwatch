// Competition upload page logic.
// Extracted from inline <script> in upload.html.

function fetchCompetitionSummary() {
  fetch('/competition/summary')
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then((data) => {
      document.getElementById('competition').textContent = data.meet || '-';
      document.getElementById('first_session_date').textContent = data.first_session_date || '-';
      document.getElementById('club_count').textContent = data.club_count || '-';
      document.getElementById('session_count').textContent = data.session_count || '-';
      document.getElementById('event_count').textContent = data.event_count || '-';
    })
    .catch(() => {
      document.getElementById('competition').textContent = 'No competition loaded';
      document.getElementById('first_session_date').textContent = '-';
      document.getElementById('club_count').textContent = '-';
      document.getElementById('session_count').textContent = '-';
      document.getElementById('event_count').textContent = '-';
    });
}

document.addEventListener('DOMContentLoaded', fetchCompetitionSummary);
