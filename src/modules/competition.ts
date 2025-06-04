import fs from 'fs';
import { parseLenex } from 'js-lenex/build/src/lenex-parse.js';
import {CompetitionData,Athlete} from '../types/types';

// TypeScript conversion of all functions and exports

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
    const result = await parseLenex(data);
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
    // Cast via unknown, want types zijn functioneel gelijk
    callback(null, result as unknown as CompetitionData);
  });
};

// MulterRequest type voor file property
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Handles file upload and processing. Pure function, no req/res.
 */
export function handleFileUploadPure(filePath: string, callback: (err: Error | string | null) => void): void {
  readAndProcessCompetitionJSON(filePath, (err, result) => {
    if (err) {
      callback(err);
      return;
    }
    fs.unlinkSync(filePath);
    callback(null);
  });
}

/**
 * Returns meet summary for given indices.
 */
export function getMeetSummary(competitionData: CompetitionData, meetIndex: number, sessionIndex: number) {
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  return {
    meet: competitionData.meets[meetIndex].name,
    first_session_date: competitionData.meets[meetIndex].sessions[sessionIndex].date,
    session_count: competitionData.meets[meetIndex].sessions.length,
    event_count: competitionData.meets[meetIndex].sessions
      .map((session: any) => session.events.length)
      .reduce((a: number, b: number) => a + b, 0),
    club_count: competitionData.meets[meetIndex].clubs.length,
  };
}

/**
 * Returns all events for a given meet/session.
 */
export function getEvents(competitionData: CompetitionData, meetIndex: number, sessionIndex: number) {
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  return competitionData.meets[meetIndex].sessions[sessionIndex].events;
}

/**
 * Returns a single event by event number.
 */
export function getEvent(competitionData: CompetitionData, meetIndex: number, sessionIndex: number, eventNumber: number) {
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  return competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event: any) => event.number === eventNumber) || null;
}

/**
 * Returns heat data or relay entries for a given event/heat.
 */
export function getHeat(competitionData: CompetitionData, meetIndex: number, sessionIndex: number, eventNumber: number, heatNumber: number) {
  if (!competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
  if (!competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  const event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event: any) => event.number === eventNumber);
  if (!event) return null;
  const heat = event.heats.find((heat: any) => heat.number === heatNumber);
  if (!heat) return null;
  if (event.swimstyle.relaycount > 1) {
    return extractRelay(competitionData, event.eventid, heat.heatid);
  }
  const entries = getAthletesByHeatId(competitionData, heat.heatid);
  if (entries.length === 0) return null;
  return entries;
}

/**
 * Deletes competition files.
 */
export function deleteCompetition() {
  if (fs.existsSync('./public/competition.json')) fs.unlinkSync('./public/competition.json');
  if (fs.existsSync('./public/events.json')) fs.unlinkSync('./public/events.json');
  if (fs.existsSync('./public/athletes.json')) fs.unlinkSync('./public/athletes.json');
}

// getAthletesByHeatId
export const getAthletesByHeatId = (competitionData: CompetitionData, heatId: string) => {
  const entries = competitionData.meets[0].clubs
    .map((club: any) => (club.athletes || []).map((athlete: any) => {
      if (!Array.isArray(athlete.entries)) {
        return null;
      }
      const filterResult = athlete.entries.filter((entry: any) => entry.heatid === heatId);
      if (filterResult.length === 0) {
        return null;
      }
      return {
        lane: filterResult[0]?.lane,
        entrytime: filterResult[0]?.entrytime,
        club: club.name,
        athletes: [{
          athleteid: athlete.athleteid,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          birthdate: athlete.birthdate,
        }],
      };
    }));
  // Flatten, filter nulls with type guard, and sort
  type EntryType = { lane: number; entrytime: string; club: string; athletes: any[] };
  const flatEntries = entries
    .flat()
    .filter((x: any): x is EntryType => x !== null)
    .sort((a: EntryType, b: EntryType) => a.lane - b.lane);
  return flatEntries;
};

// findAthleteById
export const findAthleteById = (competitionData: CompetitionData, athleteId: string): Athlete | null => {
  for (const club of competitionData.meets[0].clubs) {
    if (club.athletes) {
      for (const athlete of club.athletes) {
        if (athlete.athleteid === athleteId) {
          return athlete;
        }
      }
    }
  }
  return null;
};

// extractRelay
export const extractRelay = (competitionData: CompetitionData, event: string, heat: string) => {
  const relayEntries = competitionData.meets[0].clubs
    .map((club: any) => (club.relays || []).map((relay: any) => {
      if (!relay.entries.length || relay.entries[0].heatid !== heat || relay.entries[0].eventid !== event) {
        return null;
      }
      return {
        lane: relay.entries[0].lane,
        entrytime: relay.entries[0].entrytime,
        club: club.name,
        relayid: relay.relayid,
        athletes: relay.entries[0].relaypositions.map((position: any) => {
          const athlete = findAthleteById(competitionData, position.athleteid);
          return {
            athleteid: position.athleteid,
            firstname: athlete ? athlete.firstname : '',
            lastname: athlete ? athlete.lastname : '',
          };
        }),
      };
    }));
  // Flatten, filter nulls with type guard, and sort
  type RelayEntryType = { lane: number; entrytime: string; club: string; relayid: string; athletes: any[] };
  const flatRelayEntries = relayEntries
    .flat()
    .filter((x: any): x is RelayEntryType => x !== null)
    .sort((a: RelayEntryType, b: RelayEntryType) => a.lane - b.lane);
  return flatRelayEntries;
};

// findAthletesWithoutEntries
export function findAthletesWithoutEntries(competitionData: CompetitionData) {
  const result = [];
  for (const club of competitionData.meets[0].clubs) {
    if (Array.isArray(club.athletes)) {
      for (const athlete of club.athletes) {
        if (!Array.isArray(athlete.entries) || athlete.entries.length === 0) {
          result.push({
            club: club.name,
            athleteid: athlete.athleteid,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            birthdate: athlete.birthdate,
          });
        }
      }
    }
  }
  return result;
}
