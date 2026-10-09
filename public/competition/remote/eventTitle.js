// Shared event title formatting for the competition remote.
//
// Exports:
//   formatEventTitle(eventData)

const STROKES = {
  FREE: 'Freestyle',
  BACK: 'Backstroke',
  MEDLEY: 'Medley',
  BREAST: 'Breaststroke',
  FLY: 'Butterfly',
};

const GENDERS = {
  M: 'Men',
  F: 'Women',
  X: 'Mixed',
};

/**
 * Format an event as "100m Breaststroke Men" (relay: "4x50m Medley Women").
 * @param {{ swimstyle?: object, gender?: string }} eventData
 * @returns {string}
 */
export function formatEventTitle(eventData) {
  const { distance, relaycount, stroke } = eventData?.swimstyle || {};
  const length = relaycount > 1 ? `${relaycount}x${distance}` : `${distance}`;
  const parts = [`${length}m`, STROKES[stroke] || stroke || ''];
  const gender = GENDERS[eventData?.gender];
  if (gender) parts.push(gender);
  return parts.filter(Boolean).join(' ');
}
