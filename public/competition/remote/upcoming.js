// Heat roster and "next heat" preview for the competition remote.
// Loads the swimmers of the selected heat (shown on the lane rows) and the
// next heat. Stale responses are dropped.
//
// Exports:
//   entryToLane(entry)
//   loadHeatViews(event, heat, session, { onRoster })

import { formatEventTitle } from './eventTitle.js';

let requestId = 0;

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Turn a heat entry (athlete or relay) into the name and club shown on a lane.
 * @param {object} entry
 * @returns {{ lane: number, name: string, club: string, entrytime: string }}
 */
export function entryToLane(entry) {
  const athletes = Array.isArray(entry.athletes) ? entry.athletes : [];
  if (athletes.length > 1) {
    return {
      lane: entry.lane,
      name: `${entry.club} (relay)`,
      club: athletes.map((athlete) => athlete.lastname).join(' / '),
      entrytime: entry.entrytime ?? '',
    };
  }
  const [athlete] = athletes;
  const name = athlete ? `${athlete.firstname} ${athlete.lastname}` : `${entry.firstname ?? ''} ${entry.lastname ?? ''}`;
  return {
    lane: entry.lane,
    name: name.trim(),
    club: entry.club ?? '',
    entrytime: entry.entrytime ?? '',
  };
}

function toLanes(entries) {
  if (!Array.isArray(entries)) return null;
  return entries.flat().map(entryToLane).filter((lane) => Number.isInteger(lane.lane));
}

/** "00:01:24.10" -> "01:24.10"; anything else is shown as is. */
function formatEntryTime(entrytime) {
  if (!entrytime || entrytime === '00:00:00.00') return '';
  return entrytime.replace(/^00:/, '');
}

async function findNextHeat(event, heat, session) {
  const sessionParam = session ? `?session=${session}` : '';
  const eventData = await getJson(`/competition/event/${event}${sessionParam}`);
  if (!eventData) return null;
  if (heat < eventData.heats.length) return { event, heat: heat + 1, eventData };
  const events = await getJson(`/competition/event${sessionParam}`);
  if (!Array.isArray(events)) return null;
  const index = events.findIndex((candidate) => candidate.number === event);
  const next = index >= 0 ? events[index + 1] : null;
  if (!next) return null;
  return { event: next.number, heat: 1, eventData: next };
}

function renderNextHeat(next, lanes) {
  const title = document.getElementById('next-heat-title');
  const list = document.getElementById('next-heat-list');
  const empty = document.getElementById('next-heat-empty');
  if (!list) return;
  list.replaceChildren();
  if (!next || !lanes || lanes.length === 0) {
    if (title) title.textContent = 'Next heat';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (title) {
    title.textContent = `Next heat · event ${next.event} · heat ${next.heat} · ${formatEventTitle(next.eventData)}`;
  }
  if (empty) empty.classList.add('hidden');
  lanes.forEach((lane) => {
    const item = document.createElement('li');
    item.className = 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 py-2';
    const number = document.createElement('span');
    number.className = 'text-center font-mono font-bold text-aqua';
    number.textContent = String(lane.lane);
    const who = document.createElement('span');
    who.className = 'min-w-0';
    const name = document.createElement('span');
    name.className = 'block truncate font-semibold leading-tight';
    name.textContent = lane.name;
    const club = document.createElement('span');
    club.className = 'block truncate text-sm leading-tight text-pool-300';
    club.textContent = lane.club;
    who.append(name, club);
    const seed = document.createElement('span');
    seed.className = 'font-mono text-xs text-pool-300';
    seed.textContent = formatEntryTime(lane.entrytime);
    item.append(number, who, seed);
    list.appendChild(item);
  });
}

/**
 * Load everything that depends on the selected heat.
 * @param {number|string} event
 * @param {number|string} heat
 * @param {number|null} session
 * @param {Object} opts
 * @param {function} opts.onRoster - Called with the lanes of this heat, or null when unavailable
 */
export async function loadHeatViews(event, heat, session, { onRoster }) {
  const id = ++requestId;
  const eventNumber = parseInt(event, 10);
  const heatNumber = parseInt(heat, 10);
  const sessionNumber = session ? Number(session) : null;
  const sessionParam = sessionNumber ? `?session=${sessionNumber}` : '';
  if (!eventNumber || !heatNumber) {
    onRoster(null);
    return;
  }

  const [roster, next] = await Promise.all([
    getJson(`/competition/event/${eventNumber}/heat/${heatNumber}${sessionParam}`),
    findNextHeat(eventNumber, heatNumber, sessionNumber).then(async (found) => {
      if (!found) return null;
      const entries = await getJson(
        `/competition/event/${found.event}/heat/${found.heat}${sessionParam}`,
      );
      return { next: found, lanes: toLanes(entries) };
    }),
  ]);
  if (id !== requestId) return;

  onRoster(toLanes(roster));
  renderNextHeat(next?.next ?? null, next?.lanes ?? null);
}
