// Shared event title formatting for the competition remote.
//
// Exports:
//   formatEventTitle(eventData)

const STROKES = {
  FREE: 'Vrijeslag',
  BACK: 'Rugslag',
  MEDLEY: 'Wisselslag',
  BREAST: 'Schoolslag',
  FLY: 'Vlinderslag',
};

const GENDERS = {
  M: 'Heren',
  F: 'Dames',
  X: 'Mix',
};

/**
 * Format an event as "100m Schoolslag Heren" (relay: "4x50m Wisselslag Dames").
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
