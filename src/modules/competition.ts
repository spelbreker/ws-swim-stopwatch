import fs from 'fs';
import {
  CompetitionData,
  Athlete,
  Session,
  Event,
} from '../types/types';

function loadCompetitionData(): CompetitionData | null {
  if (!fs.existsSync('./public/competition.json')) return null;
  return JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8')) as CompetitionData;
}

// readAndProcessCompetitionJSON
export const readAndProcessCompetitionJSON = (
  filePath: string,
  callback: (err: Error | string | null, result: CompetitionData | null) => void,
): void => {
  fs.readFile(filePath, async (err, data) => {
    if (err) {
      callback(err, null);
      return;
    }
    // Dynamic import for ESM compatibility
    const { parseLenex } = await import('js-lenex/build/src/lenex-parse'); // removed .js extension
    const result = await parseLenex(data) as CompetitionData;
    // Fallbacks for type safety
    if (!result.meets) result.meets = [];
    if (!result.meets?.length) {
      callback('No meets found', null);
      return;
    }
    if (!result.meets[0]?.sessions?.length) {
      callback('No sessions found', null);
      return;
    }
    if (!result.meets[0]?.sessions[0]?.events?.length) {
      callback('No events found', null);
      return;
    }
    if (!result.meets[0]?.sessions[0]?.events[0]?.heats?.length) {
      callback('No heats found', null);
      return;
    }
    if (!result.meets[0]?.clubs?.length) {
      callback('No clubs found', null);
      return;
    }
    fs.writeFileSync('./public/competition.json', JSON.stringify(result));
    callback(null, result);
  });
};

/**
 * Returns meet summary for given indices.
 */
export function getMeetSummary(meetIndex: number, sessionIndex: number) {
  const competitionData = loadCompetitionData();
  if (!competitionData) throw new Error('Missing competition.json');
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  const meet = competitionData.meets[meetIndex];
  const session = meet.sessions[sessionIndex];
  return {
    meet: meet.name,
    first_session_date: session.date,
    session_count: meet.sessions.length,
    event_count: meet.sessions
      .map((s: Session) => s.events.length)
      .reduce((a: number, b: number) => a + b, 0),
    club_count: meet.clubs.length,
  };
}

/**
 * Returns all events for a given meet/session.
 */
export function getEvents(meetIndex: number, sessionIndex: number): Event[] {
  const competitionData = loadCompetitionData();
  if (!competitionData) throw new Error('Missing competition.json');
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  return competitionData.meets[meetIndex].sessions[sessionIndex].events;
}

/**
 * Returns a single event by event number.
 */
export function getEvent(
  meetIndex: number,
  sessionIndex: number,
  eventNumber: number,
): Event | null {
  const competitionData = loadCompetitionData();
  if (!competitionData) throw new Error('Missing competition.json');
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  return (
    competitionData.meets[meetIndex].sessions[sessionIndex].events.find(
      (ev: Event) => ev.number === eventNumber,
    ) || null
  );
}

// findAthleteById
export function findAthleteById(
  competitionData: CompetitionData,
  athleteId: string,
): Athlete | null {
  const { clubs } = competitionData.meets[0];
  return clubs.flatMap((club) => club.athletes || [])
    .find((athlete: Athlete) => athlete.athleteid === athleteId) || null;
}

// getAthletesByHeatId
export function getAthletesByHeatId(
  competitionData: CompetitionData,
  heatId: string,
) {
  const entries = competitionData.meets[0].clubs
    .flatMap((club: { name: string; athletes: Athlete[] }) => (club.athletes || []).map((athlete: Athlete) => {
      if (!Array.isArray(athlete.entries)) {
        return null;
      }
      const filterResult = athlete.entries.filter(
        (entry: { heatid: string; lane: number; entrytime: string }) => entry.heatid === heatId,
      );
      if (filterResult.length === 0) {
        return null;
      }
      return {
        lane: filterResult[0]?.lane,
        entrytime: filterResult[0]?.entrytime,
        club: club.name,
        athletes: [
          {
            athleteid: athlete.athleteid,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            birthdate: athlete.birthdate,
          },
        ],
      };
    }))
    .filter((x: unknown): x is {
      lane: number;
      entrytime: string;
      club: string;
      athletes: Array<{
        athleteid: string;
        firstname: string;
        lastname: string;
        birthdate: string;
      }>;
    } => x !== null)
    .sort((a, b) => a.lane - b.lane);
  return entries;
}

// extractRelay
export function extractRelay(
  competitionData: CompetitionData,
  eventId: string,
  heatId: string,
) {
  const relayEntries = competitionData.meets[0].clubs
    .flatMap((club: { name: string; relays?: Array<{
      relayid: string;
      entries: Array<{
        heatid: string;
        eventid: string;
        lane: number;
        entrytime: string;
        relaypositions: Array<{ athleteid: string }>;
      }>;
    }> }) => (club.relays || []).map((relay) => {
      if (
        !relay.entries.length
        || relay.entries[0].heatid !== heatId
        || relay.entries[0].eventid !== eventId
      ) {
        return null;
      }
      return {
        lane: relay.entries[0].lane,
        entrytime: relay.entries[0].entrytime,
        club: club.name,
        relayid: relay.relayid,
        athletes: relay.entries[0].relaypositions.map((position: { athleteid: string }) => {
          const athlete = findAthleteById(competitionData, position.athleteid);
          return {
            athleteid: position.athleteid,
            firstname: athlete ? athlete.firstname : '',
            lastname: athlete ? athlete.lastname : '',
            birthdate: athlete ? athlete.birthdate : '',
          };
        }),
      };
    }))
    .filter((x: unknown): x is {
      lane: number;
      entrytime: string;
      club: string;
      relayid: string;
      athletes: Array<{
        athleteid: string;
        firstname: string;
        lastname: string;
        birthdate: string;
      }>;
    } => x !== null)
    .sort((a, b) => a.lane - b.lane);
  return relayEntries;
}

// getHeat (moved below helpers)
export function getHeat(
  meetIndex: number,
  sessionIndex: number,
  eventNumber: number,
  heatNumber: number,
) {
  const competitionData = loadCompetitionData();
  if (!competitionData) throw new Error('Missing competition.json');
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  const foundEvent = competitionData.meets[meetIndex].sessions[sessionIndex].events.find(
    (ev: Event) => ev.number === eventNumber,
  );
  if (!foundEvent) return null;
  const foundHeat = foundEvent.heats.find((ht: { number: number; heatid: string }) => ht.number === heatNumber);
  if (!foundHeat) return null;
  if (foundEvent.swimstyle.relaycount > 1) {
    return extractRelay(competitionData, foundEvent.eventid, foundHeat.heatid);
  }
  const entries = getAthletesByHeatId(competitionData, foundHeat.heatid);
  if (entries.length === 0) return null;
  return entries;
}

// findAthletesWithoutEntries
export function findAthletesWithoutEntries(competitionData: CompetitionData) {
  return competitionData.meets[0].clubs.flatMap((club) => (
    Array.isArray(club.athletes)
      ? club.athletes
        .filter((athlete) => !Array.isArray(athlete.entries) || athlete.entries.length === 0)
        .map((athlete) => ({
          club: club.name,
          athleteid: athlete.athleteid,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          birthdate: athlete.birthdate,
        }))
      : []
  ));
}
