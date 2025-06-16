import fs from 'fs';
import path from 'path';
import {
  CompetitionData, Athlete, Session, Event, Club, Relay, Entry, Heat,
  LenexRoot, LenexMeet, LenexSession, LenexEvent, LenexHeat, LenexClub,
  LenexAthlete, LenexEntry, LenexRelay, LenexRelayEntry, LenexRelayPosition,
} from '../types/competition-types';

// Minimal Lenex types for conversion
function convertLenexToCompetitionData(lenex: unknown): CompetitionData {
  const l = lenex as LenexRoot;
  return {
    meets: Array.isArray(l.meets)
      ? l.meets.map((meet: LenexMeet) => ({
        name: String(meet.name ?? ''),
        sessions: Array.isArray(meet.sessions)
          ? meet.sessions.map((session: LenexSession) => ({
            date: String(session.date ?? ''),
            events: Array.isArray(session.events)
              ? session.events.map((event: LenexEvent) => ({
                number: Number(event.number),
                order: Number(event.order),
                eventid: String(event.eventid ?? event.number ?? ''),
                gender: String(event.gender ?? ''),
                swimstyle: {
                  relaycount: Number(event.swimstyle?.relaycount ?? 0),
                  stroke: String(event.swimstyle?.stroke ?? ''),
                  distance: Number(event.swimstyle?.distance ?? 0),
                },
                heats: Array.isArray(event.heats)
                  ? event.heats.map((heat: LenexHeat) => ({
                    heatid: String(heat.heatid ?? ''),
                    number: Number(heat.number),
                    order: Number(heat.order),
                    daytime: heat.daytime ? String(heat.daytime) : undefined,
                  }))
                  : [],
              }))
              : [],
          }))
          : [],
        clubs: Array.isArray(meet.clubs)
          ? meet.clubs.map((club: LenexClub) => ({
            name: String(club.name ?? ''),
            athletes: Array.isArray(club.athletes)
              ? club.athletes.map((athlete: LenexAthlete) => ({
                athleteid: String(athlete.athleteid ?? ''),
                firstname: String(athlete.firstname ?? ''),
                lastname: String(athlete.lastname ?? ''),
                birthdate: String(athlete.birthdate ?? ''),
                entries: Array.isArray(athlete.entries)
                  ? athlete.entries.map((entry: LenexEntry) => ({
                    eventid: String(entry.eventid ?? ''),
                    heatid: String(entry.heatid ?? ''),
                    entrytime: String(entry.entrytime ?? ''),
                    lane: Number(entry.lane),
                  }))
                  : [],
              }))
              : [],
            relays: Array.isArray(club.relays)
              ? club.relays.map((relay: LenexRelay) => ({
                relayid: String(relay.relayid ?? ''),
                entries: Array.isArray(relay.entries)
                  ? relay.entries.map((relayEntry: LenexRelayEntry) => ({
                    eventid: String(relayEntry.eventid ?? ''),
                    heatid: String(relayEntry.heatid ?? ''),
                    entrytime: String(relayEntry.entrytime ?? ''),
                    lane: Number(relayEntry.lane),
                    relaypositions: Array.isArray(relayEntry.relaypositions)
                      ? relayEntry.relaypositions.map((pos: LenexRelayPosition) => ({
                        athleteid: String(pos.athleteid ?? ''),
                      }))
                      : [],
                  }))
                  : [],
              }))
              : [],
          }))
          : [],
      }))
      : [],
  };
}

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
        .map((s: Session) => s.events.length)
        .reduce((a: number, b: number) => a + b, 0),
      club_count: meet.clubs.length,
    };
  }

  /**
   * Returns all events for a given meet/session.
   */
  public static getEvents(meetIndex: number, sessionIndex: number): Event[] {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    return data.meets[meetIndex].sessions[sessionIndex].events;
  }

  /**
   * Returns a single event by event number.
   */
  public static getEvent(meetIndex: number, sessionIndex: number, eventNumber: number): Event | null {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    return data.meets[meetIndex].sessions[sessionIndex].events
      .find((event: Event) => event.number === eventNumber) || null;
  }

  /**
   * Returns heat data or relay entries for a given event/heat.
   */
  public static getHeat(meetIndex: number, sessionIndex: number, eventNumber: number, heatNumber: number) {
    const data = Competition.readCompetitionDataFromDisk();
    Competition.assertValidIndices(data, meetIndex, sessionIndex);
    const event = data.meets[meetIndex].sessions[sessionIndex].events.find((ev: Event) => ev.number === eventNumber);
    if (!event) return null;
    const heat = event.heats.find((ht: Heat) => ht.number === heatNumber);
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
        (club: Club) => (Array.isArray(club.athletes) ? club.athletes : [])
          .filter((athlete: Athlete) => !Array.isArray(athlete.entries) || athlete.entries.length === 0)
          .map((athlete: Athlete) => ({
            club: club.name,
            athleteid: athlete.athleteid,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            birthdate: athlete.birthdate,
          })),
      );
  }

  private static getAthletesByHeatId(data: CompetitionData, heatId: string) {
    if (!data.meets[0]) return [];
    const entries = data.meets[0].clubs
      .map((club: Club) => (Array.isArray(club.athletes) ? club.athletes : []).map((athlete: Athlete) => {
        if (!Array.isArray(athlete.entries)) {
          return null;
        }
        const filterResult = athlete.entries.filter((entry: Entry) => entry.heatid === heatId);
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
      }))
      .flat()
      .filter((x): x is { lane: number; entrytime: string; club: string; athletes: Athlete[] } => x !== null)
      .sort((a, b) => a.lane - b.lane);
    return entries;
  }

  private static findAthleteById(data: CompetitionData, athleteId: string): Athlete | null {
    if (!data.meets[0]) return null;
    const found = data.meets[0].clubs
      .flatMap((club: Club) => (Array.isArray(club.athletes) ? club.athletes : []))
      .find((athlete: Athlete) => athlete.athleteid === athleteId);
    return found || null;
  }

  private static extractRelay(data: CompetitionData, event: string, heat: string) {
    if (!data.meets[0]) return [];
    const relayEntries = data.meets[0].clubs
      .flatMap((club: Club) => (Array.isArray(club.relays) ? club.relays : []).map((relay: Relay) => {
        if (!relay.entries.length || relay.entries[0].heatid !== heat || relay.entries[0].eventid !== event) {
          return null;
        }
        return {
          lane: relay.entries[0].lane,
          entrytime: relay.entries[0].entrytime,
          club: club.name,
          relayid: relay.relayid,
          athletes: relay.entries[0].relaypositions.map((position) => {
            const athlete = Competition.findAthleteById(data, position.athleteid);
            return {
              athleteid: position.athleteid,
              firstname: athlete ? athlete.firstname : '',
              lastname: athlete ? athlete.lastname : '',
            };
          }),
        };
      }))
      .filter((x): x is {
        lane: number;
        entrytime: string;
        club: string;
        relayid: string;
        athletes: { athleteid: string; firstname: string; lastname: string; }[]
      } => x !== null)
      .sort((a, b) => a.lane - b.lane);
    return relayEntries;
  }

  /**
   * readAndProcessCompetitionJSON
   */
  public static readAndProcessCompetitionJSON(
    filePath: string,
    callback: (err: Error | string | null, result: CompetitionData | null) => void,
  ): void {
    fs.readFile(filePath, async (err, data) => {
      if (err) {
        callback(err, null);
        return;
      }
      // Dynamic import for ESM compatibility
      // eslint-disable-next-line import/extensions
      const { parseLenex } = await import('js-lenex/build/src/lenex-parse');
      const lenexRaw = await parseLenex(data);
      const result = convertLenexToCompetitionData(lenexRaw);
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
// comp.getMeetSummary(...)
