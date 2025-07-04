import fs from 'fs';
import path from 'path';
import { LenexRaw } from 'js-lenex/src/lenex-type';
import {
  CompetitionData,
  CompetitionEvent,
  CompetitionHeat,
  CompetitionSession,
  CompetitionClub,
  CompetitionAthlete,
  CompetitionEntry,
} from '../types/competition-types';
import {
  AthleteResult,
  RelayResult,
} from '../types/competition-result-types';

class Competition {
  /**
   * Returns a summary of all meets and their sessions for selector UI.
   * Each meet includes its name, index, and a sessions array (with date/index/count).
   *
   * @returns {MeetSessionSummary[]} Array of meet/session summary objects.
   * @throws {Error} If the competition data file is missing or invalid.
   */
  public static getMeetsAndSessions(): import('../types/competition-types').MeetSessionSummary[] {
    const data = Competition.readCompetitionDataFromDisk();
    return data.meets.map((meet, meetIndex) => ({
      meetIndex,
      name: meet.name,
      city: meet.city,
      nation: meet.nation?.toString?.() ?? undefined,
      sessions: meet.sessions.map((session, sessionIndex) => ({
        sessionIndex,
        date: session.date,
        eventCount: Array.isArray(session.events) ? session.events.length : 0,
      })),
    }));
  }
  private static readonly COMPETITION_FILE_PATH = './public/competition.json';

  private static readCompetitionDataFromDisk(): CompetitionData {
    if (!fs.existsSync(Competition.COMPETITION_FILE_PATH)) {
      throw new Error('Missing competition.json');
    }
    try {
      const fileContent = fs.readFileSync(Competition.COMPETITION_FILE_PATH, 'utf-8');
      return JSON.parse(fileContent) as CompetitionData;
    } catch (err) {
      console.error('[Competition] Failed to parse competition.json:', err);
      throw new Error('Invalid competition.json');
    }
  }

  /**
   * Helper to validate competitionData, meetIndex, and sessionIndex.
   */
  private static assertValidIndices(data: CompetitionData, meetIndex: number, sessionIndex: number): void {
    if (!data.meets[meetIndex]) throw new Error('Invalid meetIndex');
    if (!data.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  }

  /**
   * Returns meet summary for given indices.
   */
  public static getMeetSummary(meetIndex: number, sessionIndex: number): {
    meet: string;
    first_session_date: string;
    session_count: number;
    event_count: number;
    club_count: number;
  } {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    const meet = data.meets[meetIndex];
    const session = meet.sessions[sessionIndex];
    return {
      meet: meet.name,
      first_session_date: session.date,
      session_count: meet.sessions.length,
      event_count: meet.sessions
        .map((s: CompetitionSession) => s.events.length)
        .reduce((a: number, b: number) => a + b, 0),
      club_count: meet.clubs.length,
    };
  }

  /**
   * Returns all events for a given meet/session.
   */
  public static getEvents(meetIndex: number, sessionIndex: number): CompetitionEvent[] {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    return data.meets[meetIndex].sessions[sessionIndex].events;
  }

  /**
   * Returns a single event by event number.
   */
  public static getEvent(meetIndex: number, sessionIndex: number, eventNumber: number): CompetitionEvent | null {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    return data.meets[meetIndex].sessions[sessionIndex].events
      .find((event: CompetitionEvent) => event.number === eventNumber) || null;
  }

  /**
   * Returns heat data or relay entries for a given event/heat.
   */
  public static getHeat(meetIndex: number, sessionIndex: number, eventNumber: number, heatNumber: number) {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    const { events } = data.meets[meetIndex].sessions[sessionIndex];
    const event = events.find((ev: CompetitionEvent) => ev.number === eventNumber);
    if (!event) return null;
    const heat = event.heats.find((ht: CompetitionHeat) => ht.number === heatNumber);
    if (!heat) return null;
    if (event.swimstyle.relaycount > 1) {
      return Competition.extractRelay(data, event.eventid, heat.heatid);
    }
    const entries = Competition.getAthletesByHeatId(data, heat.heatid);
    if (entries.length === 0) return null;
    return entries;
  }

  public static findAthletesWithoutEntries() {
    const data = Competition.readCompetitionDataFromDisk();
    if (!data.meets[0]) return [];
    return data.meets[0].clubs
      .flatMap(
        (club: CompetitionClub) => (Array.isArray(club.athletes) ? club.athletes : [])
          .filter((athlete: CompetitionAthlete) => !Array.isArray(athlete.entries) || athlete.entries.length === 0)
          .map((athlete: CompetitionAthlete) => ({
            club: club.name,
            athleteid: athlete.athleteid,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            birthdate: athlete.birthdate,
          })),
      );
  }

  private static getAthletesByHeatId(data: CompetitionData, heatId: string) {
    const defaultMeet = data.meets[0];
    if (!defaultMeet) return [];

    const entries = defaultMeet.clubs
      .flatMap((club: CompetitionClub) => {
        if (!Array.isArray(club.athletes)) return [];

        return club.athletes.map((athlete: CompetitionAthlete) => {
          if (!Array.isArray(athlete.entries)) return null;

          const filterResult = athlete.entries.filter(
            (entry: CompetitionEntry) => entry.heatid === heatId,
          );
          if (filterResult.length === 0) return null;

          const [firstEntry] = filterResult;
          return {
            lane: firstEntry.lane,
            entrytime: firstEntry.entrytime,
            club: club.name,
            athletes: [{
              athleteid: athlete.athleteid,
              firstname: athlete.firstname,
              lastname: athlete.lastname,
              birthdate: athlete.birthdate,
            }],
          };
        });
      })
      .filter((x): x is AthleteResult => x !== null)
      .sort((a, b) => a.lane - b.lane);

    return entries;
  }

  private static findAthleteById(data: CompetitionData, athleteId: number): CompetitionAthlete | null {
    const defaultMeet = data.meets[0];
    if (!defaultMeet) return null;

    const found = defaultMeet.clubs
      .flatMap((club) => (Array.isArray(club.athletes) ? club.athletes : []))
      .find((athlete) => athlete.athleteid === athleteId);

    return found || null;
  }

  private static extractRelay(data: CompetitionData, event: string, heat: string) {
    const defaultMeet = data.meets[0];
    if (!defaultMeet) return [];

    const relayEntries = defaultMeet.clubs
      .flatMap((club) => {
        if (!Array.isArray(club.relays)) return [];

        return club.relays.map((relay) => {
          const firstEntry = relay.entries[0];
          if (!firstEntry || firstEntry.heatid !== heat || firstEntry.eventid !== event) return null;

          return {
            lane: firstEntry.lane,
            entrytime: firstEntry.entrytime,
            club: club.name,
            relayid: relay.relayid,
            athletes: firstEntry.relaypositions.map((position) => {
              const athlete = Competition.findAthleteById(data, position.athleteid);
              return {
                athleteid: position.athleteid,
                firstname: athlete?.firstname ?? '',
                lastname: athlete?.lastname ?? '',
              };
            }),
          };
        });
      })
      .filter((x): x is RelayResult => x !== null)
      .sort((a, b) => a.lane - b.lane);

    return relayEntries;
  }

  /**
   * readAndProcessCompetitionJSON
   */
  public static readAndProcessCompetitionJSON(
    filePath: string,
    callback: (err: Error | string | null, result: LenexRaw | null) => void,
  ): void {
    fs.readFile(filePath, async (err, data) => {
      if (err) {
        callback(err, null);
        return;
      }
      // Dynamic import for ESM compatibility
      const { parseLenex } = await import('js-lenex/build/src/lenex-parse');
      const result = await parseLenex(data);
      // Fallbacks for type safety
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
      // Use absolute path for reliability
      const absPath = path.resolve(process.cwd(), 'public', 'competition.json');
      console.log('[Competition] Writing competition.json to:', absPath);
      try {
        fs.writeFileSync(absPath, JSON.stringify(result));
      } catch (writeErr) {
        const error = writeErr instanceof Error ? writeErr : new Error(String(writeErr));
        console.error('[Competition] Failed to write competition.json:', error);
        callback(error, null);
        return;
      }
      callback(null, result);
    });
  }
}

export default Competition;

// Usage: import Competition from './competition';
// const comp = new Competition();
// comp.getMeetSummary(...
