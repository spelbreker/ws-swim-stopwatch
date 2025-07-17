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
   * Returns all sessions for the specified meet.
   * @param meetIndex - Index of the meet (defaults to 0 for first meet)
   * @returns Array of competition sessions with session numbers, dates, times, and events
   */
  public static getSessions(meetIndex: number = 0): CompetitionSession[] {
    const data = Competition.readCompetitionDataFromDisk();
    if (!data.meets[meetIndex]) throw new Error('Invalid meetIndex');
    return data.meets[meetIndex].sessions;
  }

  /**
   * Helper to find session index by session number.
   * @param data - Competition data object
   * @param meetIndex - Index of the meet
   * @param sessionNumber - Session number (1-based, not index)
   * @returns Session index (0-based) for internal use
   * @throws Error if meetIndex is invalid or session number not found
   */
  private static findSessionIndexByNumber(data: CompetitionData, meetIndex: number, sessionNumber: number): number {
    const sessions = data.meets[meetIndex]?.sessions;
    if (!sessions) throw new Error('Invalid meetIndex');

    const sessionIndex = sessions.findIndex(session => session.number === sessionNumber);
    if (sessionIndex === -1) throw new Error(`Session with number ${sessionNumber} not found`);

    return sessionIndex;
  }

  /**
   * Updated helper to validate indices and handle session number parameter.
   * Converts session numbers to indices and provides fallback to first session.
   * @param data - Competition data object
   * @param meetIndex - Index of the meet
   * @param sessionNumber - Optional session number (1-based). If undefined, uses first session
   * @returns Session index (0-based) for internal use
   * @throws Error if meetIndex is invalid, session number not found, or no sessions exist
   */
  private static assertValidIndicesWithSessionNumber(
    data: CompetitionData,
    meetIndex: number,
    sessionNumber?: number
  ): number {
    if (!data.meets[meetIndex]) throw new Error('Invalid meetIndex');

    if (sessionNumber !== undefined) {
      return Competition.findSessionIndexByNumber(data, meetIndex, sessionNumber);
    }

    // Default to first session if no sessionNumber provided
    if (!data.meets[meetIndex].sessions[0]) throw new Error('No sessions found');
    return 0;
  }

  /**
   * Returns meet summary for given meet and optional session.
   * @param meetIndex - Index of the meet (defaults to 0)
   * @param sessionNumber - Optional session number. If not provided, uses first session
   * @returns Object containing meet name, session info, and counts
   */
  public static getMeetSummary(meetIndex: number, sessionNumber?: number): {
    meet: string;
    first_session_date: string;
    session_count: number;
    event_count: number;
    club_count: number;
  } {
    const data = Competition.readCompetitionDataFromDisk();
    const sessionIndex = Competition.assertValidIndicesWithSessionNumber(data, meetIndex, sessionNumber);
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
   * Returns all events for a given meet and session.
   * @param meetIndex - Index of the meet (defaults to 0)
   * @param sessionNumber - Optional session number. If not provided, uses first session
   * @returns Array of competition events for the specified session
   */
  public static getEvents(meetIndex: number, sessionNumber?: number): CompetitionEvent[] {
    const data = Competition.readCompetitionDataFromDisk();
    const sessionIndex = Competition.assertValidIndicesWithSessionNumber(data, meetIndex, sessionNumber);
    return data.meets[meetIndex].sessions[sessionIndex].events;
  }

  /**
   * Returns a single event by event number from a specific session.
   * @param meetIndex - Index of the meet (defaults to 0)
   * @param sessionNumber - Optional session number. If not provided, uses first session
   * @param eventNumber - Event number to find (1-based)
   * @returns Competition event object or null if not found
   */
  public static getEvent(meetIndex: number, sessionNumber: number | undefined, eventNumber: number): CompetitionEvent | null {
    const data = Competition.readCompetitionDataFromDisk();
    const sessionIndex = Competition.assertValidIndicesWithSessionNumber(data, meetIndex, sessionNumber);
    return data.meets[meetIndex].sessions[sessionIndex].events
      .find((event: CompetitionEvent) => event.number === eventNumber) || null;
  }

  /**
   * Returns heat data or relay entries for a given event and heat in a specific session.
   * Automatically detects relay events and returns appropriate data structure.
   * @param meetIndex - Index of the meet (defaults to 0)
   * @param sessionNumber - Optional session number. If not provided, uses first session
   * @param eventNumber - Event number (1-based)
   * @param heatNumber - Heat number (1-based)
   * @returns Array of athlete entries for individual events or relay entries for relay events, null if not found
   */
  public static getHeat(meetIndex: number, sessionNumber: number | undefined, eventNumber: number, heatNumber: number) {
    const data = Competition.readCompetitionDataFromDisk();
    const sessionIndex = Competition.assertValidIndicesWithSessionNumber(data, meetIndex, sessionNumber);
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

  /**
   * Finds athletes that don't have any competition entries.
   * @returns Array of athletes without entries, including club information
   */
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

  /**
   * Retrieves athlete entries for a specific heat, sorted by lane.
   * @param data - Competition data object
   * @param heatId - Heat identifier string
   * @returns Array of athlete results sorted by lane number
   */
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

  /**
   * Finds an athlete by their unique ID across all clubs.
   * @param data - Competition data object
   * @param athleteId - Unique athlete identifier
   * @returns Athlete object or null if not found
   */
  private static findAthleteById(data: CompetitionData, athleteId: number): CompetitionAthlete | null {
    const defaultMeet = data.meets[0];
    if (!defaultMeet) return null;

    const found = defaultMeet.clubs
      .flatMap((club) => (Array.isArray(club.athletes) ? club.athletes : []))
      .find((athlete) => athlete.athleteid === athleteId);

    return found || null;
  }

  /**
   * Extracts relay team information for a specific event and heat.
   * @param data - Competition data object
   * @param event - Event identifier string
   * @param heat - Heat identifier string
   * @returns Array of relay results with team members, sorted by lane
   */
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
   * Reads and processes a Lenex competition file, converting it to internal format.
   * Validates the structure and writes the processed data to public/competition.json.
   * @param filePath - Path to the Lenex file to process
   * @param callback - Callback function with error and result parameters
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
