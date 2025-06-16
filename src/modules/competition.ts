import fs from 'fs';
import path from 'path';
import { CompetitionData, Athlete } from '../types/types';

class Competition {
  private competitionData: CompetitionData | null = null;

  private static readonly COMPETITION_FILE_PATH = './public/competition.json';

  constructor() {
    this.loadCompetitionData();
  }

  private loadCompetitionData(): void {
    if (!fs.existsSync(Competition.COMPETITION_FILE_PATH)) {
      this.competitionData = null;
      return;
    }
    try {
      const fileContent = fs.readFileSync(Competition.COMPETITION_FILE_PATH, 'utf-8');
      this.competitionData = JSON.parse(fileContent);
    } catch (err) {
      console.error('[Competition] Failed to parse competition.json:', err);
      this.competitionData = null;
    }
  }

  // readAndProcessCompetitionJSON
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
      const { parseLenex } = await import('js-lenex/build/src/lenex-parse.js');
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
      callback(null, result as unknown as CompetitionData);
    });
  };

  /**
   * Helper to validate competitionData, meetIndex, and sessionIndex.
   */
  private assertValidIndices(meetIndex: number, sessionIndex: number): void {
    if (!this.competitionData) throw new Error('Missing competition.json');
    if (!this.competitionData.meets[meetIndex]) throw new Error('Invalid meetIndex');
    if (!this.competitionData.meets[meetIndex].sessions[sessionIndex]) throw new Error('Invalid sessionIndex');
  }

  /**
   * Returns meet summary for given indices.
   */
  public getMeetSummary(meetIndex: number, sessionIndex: number) {
    this.assertValidIndices(meetIndex, sessionIndex);
    return {
      meet: this.competitionData!.meets[meetIndex].name,
      first_session_date: this.competitionData!.meets[meetIndex].sessions[sessionIndex].date,
      session_count: this.competitionData!.meets[meetIndex].sessions.length,
      event_count: this.competitionData!.meets[meetIndex].sessions
        .map((session: any) => session.events.length)
        .reduce((a: number, b: number) => a + b, 0),
      club_count: this.competitionData!.meets[meetIndex].clubs.length,
    };
  }

  /**
   * Returns all events for a given meet/session.
   */
  public getEvents(meetIndex: number, sessionIndex: number) {
    this.assertValidIndices(meetIndex, sessionIndex);
    return this.competitionData!.meets[meetIndex].sessions[sessionIndex].events;
  }

  /**
   * Returns a single event by event number.
   */
  public getEvent(meetIndex: number, sessionIndex: number, eventNumber: number) {
    this.assertValidIndices(meetIndex, sessionIndex);
    return this.competitionData!.meets[meetIndex].sessions[sessionIndex].events.find((event: any) => event.number === eventNumber) || null;
  }

  /**
   * Returns heat data or relay entries for a given event/heat.
   */
  public getHeat(meetIndex: number, sessionIndex: number, eventNumber: number, heatNumber: number) {
    this.assertValidIndices(meetIndex, sessionIndex);
    const event = this.competitionData!.meets[meetIndex].sessions[sessionIndex].events.find((event: any) => event.number === eventNumber);
    if (!event) return null;
    const heat = event.heats.find((heat: any) => heat.number === heatNumber);
    if (!heat) return null;
    if (event.swimstyle.relaycount > 1) {
      return this.extractRelay(event.eventid, heat.heatid);
    }
    const entries = this.getAthletesByHeatId(heat.heatid);
    if (entries.length === 0) return null;
    return entries;
  }

  private getAthletesByHeatId(heatId: string) {
    if (!this.competitionData) return [];
    const entries = this.competitionData.meets[0].clubs
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
    type EntryType = { lane: number; entrytime: string; club: string; athletes: any[] };
    const flatEntries = entries
      .flat()
      .filter((x: any): x is EntryType => x !== null)
      .sort((a: EntryType, b: EntryType) => a.lane - b.lane);
    return flatEntries;
  }

  private findAthleteById(athleteId: string): Athlete | null {
    if (!this.competitionData) return null;
    for (const club of this.competitionData.meets[0].clubs) {
      if (club.athletes) {
        for (const athlete of club.athletes) {
          if (athlete.athleteid === athleteId) {
            return athlete;
          }
        }
      }
    }
    return null;
  }

  private extractRelay(event: string, heat: string) {
    if (!this.competitionData) return [];
    const relayEntries = this.competitionData.meets[0].clubs
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
            const athlete = this.findAthleteById(position.athleteid);
            return {
              athleteid: position.athleteid,
              firstname: athlete ? athlete.firstname : '',
              lastname: athlete ? athlete.lastname : '',
            };
          }),
        };
      }));
    type RelayEntryType = { lane: number; entrytime: string; club: string; relayid: string; athletes: any[] };
    const flatRelayEntries = relayEntries
      .flat()
      .filter((x: any): x is RelayEntryType => x !== null)
      .sort((a: RelayEntryType, b: RelayEntryType) => a.lane - b.lane);
    return flatRelayEntries;
  }

  public findAthletesWithoutEntries() {
    if (!this.competitionData) return [];
    const result = [];
    for (const club of this.competitionData.meets[0].clubs) {
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

  public reload(): void {
    this.loadCompetitionData();
  }
}

export default Competition;

// Usage: import Competition from './competition';
// const comp = new Competition();
// comp.getMeetSummary(...)
