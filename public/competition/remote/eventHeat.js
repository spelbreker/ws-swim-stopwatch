// Event and heat selection logic for the competition remote.
// Handles dropdown population, increment buttons, info bar updates,
// and sending event-heat messages over WebSocket.
//
// Exports:
//   initEventHeat({ send, getCurrentSession })
//   fillSelectOptions(selectElement, maxValue)
//   sendEventAndHeat(event, heat, send, session)
//   updateEventHeatInfoBar(eventNr, heatNr, session)
//   onHeatDisplayed(listener)

import { formatEventTitle } from './eventTitle.js';

let eventSelect = null;
let heatSelect = null;
let heatDisplayedListener = null;

/**
 * Register a listener that runs every time the info bar is refreshed for a heat
 * (heat roster and next-heat views follow the selection through this).
 * @param {function} listener - Called with (eventNr, heatNr, session)
 */
export function onHeatDisplayed(listener) {
  heatDisplayedListener = listener;
}

/**
 * Populate the event select dropdown by fetching the event list from the server.
 * Falls back to filling 1..maxValue if the fetch fails.
 * @param {HTMLSelectElement} selectElement
 * @param {number} maxValue - Fallback max value
 * @param {number|null} session - Current session number
 */
export async function fillSelectOptions(selectElement, maxValue, session) {
  if (!selectElement) return;

  if (selectElement.id === 'event-select') {
    const sessionParam = session ? `?session=${session}` : '';
    try {
      const res = await fetch(`/competition/event${sessionParam}`);
      if (!res.ok) throw new Error('Failed to fetch event list');
      const events = await res.json();
      selectElement.innerHTML = '';
      events.forEach((event) => {
        const option = document.createElement('option');
        option.value = event.number;
        option.textContent = event.number;
        selectElement.appendChild(option);
      });
    } catch {
      selectElement.innerHTML = '';
      for (let i = 1; i <= maxValue; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        selectElement.appendChild(option);
      }
    }
  } else {
    // Heat select: simple 1..maxValue fill
    selectElement.innerHTML = '';
    for (let i = 1; i <= maxValue; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i;
      selectElement.appendChild(option);
    }
  }
}

/**
 * Send an event-heat message over WebSocket.
 * @param {number|string} event
 * @param {number|string} heat
 * @param {function} send - WebSocket send function
 * @param {number|null} session - Current session number
 */
export function sendEventAndHeat(event, heat, send, session) {
  const message = { type: 'event-heat', event, heat };
  if (session) {
    message.session = session;
  }
  send(message);
}

/**
 * Update the heat card with the event title and "EVENT n · HEAT x / y".
 * @param {number|string} eventNr
 * @param {number|string} heatNr
 * @param {number|null} session
 */
export async function updateEventHeatInfoBar(eventNr, heatNr, session) {
  if (heatDisplayedListener) heatDisplayedListener(eventNr, heatNr, session);
  const infoBar = document.getElementById('event-heat-info-bar');
  const kicker = document.getElementById('heat-kicker');
  if (!infoBar) return;

  try {
    const sessionParam = session ? `?session=${session}` : '';
    const eventRes = await fetch(`/competition/event/${eventNr}${sessionParam}`);
    if (!eventRes.ok) throw new Error('Event fetch failed');
    const eventData = await eventRes.json();
    const maxHeatNr = eventData.heats.length;
    infoBar.textContent = formatEventTitle(eventData);
    if (kicker) kicker.textContent = `EVENT ${eventNr} · HEAT ${heatNr} / ${maxHeatNr}`;
  } catch {
    infoBar.textContent = 'Unknown event/heat';
    if (kicker) kicker.textContent = `EVENT ${eventNr} · HEAT ${heatNr}`;
  }
}

/**
 * Initialize event/heat select elements and increment buttons.
 * @param {Object} opts
 * @param {function} opts.send - WebSocket send function
 * @param {function} opts.getCurrentSession - Returns current session number or null
 */
export function initEventHeat({ send, getCurrentSession }) {
  eventSelect = document.getElementById('event-select');
  heatSelect = document.getElementById('heat-select');
  const incrementEventButton = document.getElementById('increment-event');
  const incrementHeatButton = document.getElementById('increment-heat');
  const decrementEventButton = document.getElementById('decrement-event');
  const decrementHeatButton = document.getElementById('decrement-heat');

  function decrementEvent() {
    const currentIndex = eventSelect.selectedIndex;
    if (currentIndex > 0) {
      eventSelect.selectedIndex = currentIndex - 1;
      heatSelect.value = 1;
      sendEventAndHeat(eventSelect.value, 1, send, getCurrentSession());
      updateEventHeatInfoBar(eventSelect.value, 1, getCurrentSession());
    }
  }

  function decrementHeat() {
    const currentHeat = parseInt(heatSelect.value, 10);
    if (currentHeat > 1) {
      heatSelect.value = currentHeat - 1;
      sendEventAndHeat(parseInt(eventSelect.value, 10), currentHeat - 1, send, getCurrentSession());
      updateEventHeatInfoBar(eventSelect.value, currentHeat - 1, getCurrentSession());
    }
  }

  function incrementEvent() {
    const options = eventSelect.options;
    const currentIndex = eventSelect.selectedIndex;
    if (currentIndex < options.length - 1) {
      eventSelect.selectedIndex = currentIndex + 1;
      heatSelect.value = 1;
      sendEventAndHeat(eventSelect.value, 1, send, getCurrentSession());
      updateEventHeatInfoBar(eventSelect.value, 1, getCurrentSession());
    }
  }

  function incrementHeat() {
    const currentHeat = parseInt(heatSelect.value, 10);
    if (currentHeat < 20) {
      heatSelect.value = currentHeat + 1;
      sendEventAndHeat(parseInt(eventSelect.value, 10), currentHeat + 1, send, getCurrentSession());
      updateEventHeatInfoBar(eventSelect.value, currentHeat + 1, getCurrentSession());
    }
  }

  if (incrementEventButton) incrementEventButton.addEventListener('click', incrementEvent);
  if (incrementHeatButton) incrementHeatButton.addEventListener('click', incrementHeat);
  if (decrementEventButton) decrementEventButton.addEventListener('click', decrementEvent);
  if (decrementHeatButton) decrementHeatButton.addEventListener('click', decrementHeat);

  if (eventSelect) {
    eventSelect.addEventListener('change', () => {
      heatSelect.value = 1;
      sendEventAndHeat(eventSelect.value, 1, send, getCurrentSession());
      updateEventHeatInfoBar(eventSelect.value, 1, getCurrentSession());
    });
  }

  if (heatSelect) {
    heatSelect.addEventListener('change', () => {
      sendEventAndHeat(eventSelect.value, heatSelect.value, send, getCurrentSession());
      updateEventHeatInfoBar(eventSelect.value, heatSelect.value, getCurrentSession());
    });
  }

  return {
    eventSelect, heatSelect, incrementEvent, incrementHeat, decrementEvent, decrementHeat,
  };
}
