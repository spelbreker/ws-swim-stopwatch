// Lane display logic for the competition screen.
// Handles fetching competition data, rendering lane info, split times,
// arrival ranking, and finish markers.
//
// Exports:
//   fetchCompetitionData(eventNum, heatNum, sessionNum)
//   clearLaneInformation()
//   clearSplitTimes()
//   clearArrivalOrders()
//   renderRanking(ranking)
//   renderSplitTime(splitCell, distance, formattedTime)
//   formatSwimStyle(swimstyle)

import { formatLapTime } from '../../js/modules/format.js';
import { getStartTime } from './stopwatch.js';

function pad(n) {
  return n.toString().padStart(2, '0');
}

/**
 * Fetch event and heat data from the API and update the display.
 * @param {number} eventNum
 * @param {number} heatNum
 * @param {number|null} sessionNum
 */
export async function fetchCompetitionData(eventNum, heatNum, sessionNum = null) {
  const sessionParam = sessionNum ? `?session=${sessionNum}` : '';

  try {
    const eventRes = await fetch(`/competition/event/${eventNum}${sessionParam}`);
    const eventData = await eventRes.json();

    const swimStyleElement = document.getElementById('swim-style');
    if (swimStyleElement) {
      swimStyleElement.textContent = formatSwimStyle(eventData.swimstyle);
    }

    const heatRes = await fetch(`/competition/event/${eventNum}/heat/${heatNum}${sessionParam}`);
    const heatData = await heatRes.json();
    updateLaneInformation(heatData);
  } catch {
    clearLaneInformation();
    console.warn('Error fetching competition data');
  }
}

function updateLaneInformation(entries) {
  clearLaneInformation();
  if (!Array.isArray(entries)) {
    entries = [entries];
  }
  entries.forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((athlete) => updateLaneDisplay(athlete));
    } else {
      updateLaneDisplay(entry);
    }
  });
}

function updateLaneDisplay(athlete) {
  const laneElement = document.getElementById(`lane-${athlete.lane}`);
  if (!laneElement) return;
  laneElement.querySelector('.club').textContent = athlete.club;
  clearSplitTimes();

  if (athlete.athletes) {
    const athleteNames = athlete.athletes.length === 1
      ? `${athlete.athletes[0].firstname} ${athlete.athletes[0].lastname}`
      : athlete.athletes.map((a) => `${a.firstname.substring(0, 3)}...`).join(' / ');
    laneElement.querySelector('.athlete').textContent = athleteNames;
  } else {
    laneElement.querySelector('.athlete').textContent = `${athlete.firstname} ${athlete.lastname}`;
  }
}

export function clearLaneInformation() {
  for (let i = 0; i <= 9; i++) {
    const laneElement = document.getElementById(`lane-${i}`);
    if (laneElement) {
      laneElement.querySelector('.athlete').textContent = '';
      laneElement.querySelector('.club').textContent = '';
      laneElement.querySelector('.split-time').textContent = '---:---:---';
      laneElement.querySelector('.arrival-order').textContent = '';
      laneElement.classList.remove('finished');
    }
  }
}

export function clearSplitTimes() {
  document.querySelectorAll('.split-time').forEach((element) => {
    element.textContent = '---:---:---';
  });
}

export function clearArrivalOrders() {
  document.querySelectorAll('.arrival-order').forEach((element) => {
    element.textContent = '';
  });
  document.querySelectorAll('.lane.finished').forEach((element) => {
    element.classList.remove('finished');
  });
}

/**
 * Redraw all arrival-order cells from the server-provided ranking array.
 * @param {Array<{lane: number, place: number}>} ranking
 */
export function renderRanking(ranking) {
  if (!Array.isArray(ranking)) return;
  document.querySelectorAll('.arrival-order').forEach((element) => {
    element.textContent = '';
  });
  ranking.forEach(({ lane, place }) => {
    const laneElement = document.getElementById(`lane-${lane}`);
    const cell = laneElement && laneElement.querySelector('.arrival-order');
    if (cell) cell.textContent = place;
  });
}

/**
 * Render a split time cell with distance label and formatted time.
 * Uses DOM nodes rather than innerHTML for safety.
 * @param {HTMLElement} splitCell
 * @param {number} distance
 * @param {string} formattedTime
 */
export function renderSplitTime(splitCell, distance, formattedTime) {
  splitCell.textContent = '';
  if (distance) {
    const label = document.createElement('span');
    label.className = 'split-distance';
    label.textContent = `${distance}m`;
    splitCell.appendChild(label);
    splitCell.appendChild(document.createTextNode(' '));
  }
  splitCell.appendChild(document.createTextNode(formattedTime));
}

/**
 * Format a swim style object into a human-readable string.
 * @param {Object} swimstyle
 * @returns {string}
 */
export function formatSwimStyle(swimstyle) {
  if (!swimstyle) return '';
  const { distance, relaycount, stroke } = swimstyle;
  const strokeTranslation = {
    FREE: 'Vrije slag',
    BACK: 'Rugslag',
    MEDLEY: 'Wisselslag',
    BREAST: 'Schoolslag',
    FLY: 'Vlinderslag',
  };
  const translatedStroke = strokeTranslation[stroke] || stroke;
  if (relaycount > 1) {
    return `${relaycount} x ${distance}M ${translatedStroke}`;
  }
  return `${distance}M ${translatedStroke}`;
}

/**
 * Format a split timestamp using the shared formatLapTime and current start time.
 * @param {number} ts
 * @returns {string}
 */
export function formatSplitTime(ts) {
  return formatLapTime(ts, getStartTime() || 0);
}
