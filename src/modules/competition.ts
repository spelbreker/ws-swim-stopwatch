import fs from 'fs';
import { parseLenex } from 'js-lenex/build/src/lenex-parse.js';
// Removed Request, Response from express
import {
  CompetitionData,
  Athlete,
  // Club, // Not directly used in return types of exported functions here
  // Event, // Not directly used in return types of exported functions here
  // Heat, // Not directly used in return types of exported functions here
  // Relay, // Not directly used in return types of exported functions here
  // RelayEntry, // Not directly used in return types of exported functions here
  // RelayPosition, // Not directly used in return types of exported functions here
} from '../types/types';

const COMPETITION_FILE_PATH = './public/competition.json';

// Custom Error for service layer
export class CompetitionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export const readAndProcessLenexFile = (
  lenexFilePath: string,
  outputFilePath: string = COMPETITION_FILE_PATH
): Promise<CompetitionData> => {
  return new Promise((resolve, reject) => {
    fs.readFile(lenexFilePath, async (err, data) => {
      if (err) {
        return reject(new CompetitionError(`Failed to read lenex file: ${err.message}`, 500));
      }
      try {
        const result = await parseLenex(data);
        if (!result.meets || !result.meets.length) {
          return reject(new CompetitionError('No meets found in Lenex file', 400));
        }
        // Add other necessary validations as per original readAndProcessCompetitionJSON
        fs.writeFileSync(outputFilePath, JSON.stringify(result));
        // Cast via unknown, as types are functionally similar
        resolve(result as unknown as CompetitionData);
      } catch (parseErr: any) {
        reject(new CompetitionError(`Error parsing Lenex data: ${parseErr.message}`, 500));
      }
    });
  });
};

const loadCompetitionData = (): CompetitionData => {
  if (!fs.existsSync(COMPETITION_FILE_PATH)) {
    throw new CompetitionError('Competition data file not found.', 404);
  }
  try {
    return JSON.parse(fs.readFileSync(COMPETITION_FILE_PATH, 'utf-8')) as CompetitionData;
  } catch (e: any) {
    throw new CompetitionError(`Error reading or parsing competition data: ${e.message}`, 500);
  }
};

export const processUploadedFile = async (uploadedFilePath: string): Promise<void> => {
  try {
    await readAndProcessLenexFile(uploadedFilePath, COMPETITION_FILE_PATH);
    // The file is processed and saved by readAndProcessLenexFile
  } finally {
    // Clean up the uploaded file whether processing succeeded or failed
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
  }
};

export const getMeetSummaryService = (meetIndex: number = 0, sessionIndex: number = 0) => {
  const competitionData = loadCompetitionData();
  if (!competitionData.meets || !competitionData.meets[meetIndex]) {
    throw new CompetitionError('Meet not found.', 404);
  }
  const meet = competitionData.meets[meetIndex];
  if (!meet.sessions || !meet.sessions[sessionIndex]) {
    throw new CompetitionError('Session not found.', 404);
  }
  // const session = meet.sessions[sessionIndex];

  return {
    meetName: meet.name,
    firstSessionDate: meet.sessions[sessionIndex]?.date, // Added optional chaining for safety
    sessionCount: meet.sessions.length,
    eventCount: meet.sessions
      .map((s: any) => s.events.length)
      .reduce((a: number, b: number) => a + b, 0),
    clubCount: meet.clubs?.length || 0, // Added fallback for clubs
  };
};

export const getEventsService = (meetIndex: number = 0, sessionIndex: number = 0) => {
  const competitionData = loadCompetitionData();
  if (!competitionData.meets || !competitionData.meets[meetIndex]) {
    throw new CompetitionError('Meet not found.', 404);
  }
  const meet = competitionData.meets[meetIndex];
  if (!meet.sessions || !meet.sessions[sessionIndex]) {
    throw new CompetitionError('Session not found.', 404);
  }
  const session = meet.sessions[sessionIndex];
  return session.events || []; // Return empty array if events are undefined
};

export const getEventService = (eventNumber: number, meetIndex: number = 0, sessionIndex: number = 0) => {
  const competitionData = loadCompetitionData();
  if (!competitionData.meets || !competitionData.meets[meetIndex]) {
    throw new CompetitionError('Meet not found.', 404);
  }
  const meet = competitionData.meets[meetIndex];
  if (!meet.sessions || !meet.sessions[sessionIndex]) {
    throw new CompetitionError('Session not found.', 404);
  }
  const session = meet.sessions[sessionIndex];
  const event = session.events?.find((e: any) => e.number === eventNumber);
  if (!event) {
    throw new CompetitionError('Event not found.', 404);
  }
  return event;
};

export const getHeatService = (eventNumber: number, heatNumber: number, meetIndex: number = 0, sessionIndex: number = 0) => {
  const competitionData = loadCompetitionData();
  const event = getEventService(eventNumber, meetIndex, sessionIndex); // Reuse getEventService logic

  const heat = event.heats?.find((h: any) => h.number === heatNumber);
  if (!heat) {
    throw new CompetitionError('Heat not found.', 404);
  }

  if (event.swimstyle?.relaycount > 1) { // Added optional chaining for swimstyle
    return extractRelayService(competitionData, event.eventid, heat.heatid);
  }
  const entries = getAthletesByHeatIdService(competitionData, heat.heatid);
  if (entries.length === 0) {
    // This case might not be an error, but just an empty heat.
    // Depending on requirements, could return empty array or throw specific error.
    // For now, returning empty array as per original logic's implication (not sending 404 explicitly here)
    return [];
  }
  return entries;
};

export const deleteCompetitionService = (): void => {
  const filesToDelete = [COMPETITION_FILE_PATH, './public/events.json', './public/athletes.json'];
  let deletedCount = 0;
  filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      deletedCount++;
    }
  });
  if (deletedCount === 0 && !fs.existsSync(COMPETITION_FILE_PATH)) {
    // If main file didn't exist and nothing was deleted, maybe that's an issue?
    // Or it's fine, implies already deleted. For now, not throwing error.
  }
  // No specific return value needed, throws error on fs.unlinkSync failure.
};

// getAthletesByHeatIdService (renamed, logic mostly same)
export const getAthletesByHeatIdService = (competitionData: CompetitionData, heatId: string) => {
  const entries = competitionData.meets[0]?.clubs // Added optional chaining
    ?.map((club: any) => (club.athletes || []).map((athlete: any) => {
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
  const flatEntries = (entries || []) // Handle case where entries might be undefined
    .flat()
    .filter((x: any): x is EntryType => x !== null)
    .sort((a: EntryType, b: EntryType) => a.lane - b.lane);
  return flatEntries;
};

// findAthleteByIdService (renamed, logic same)
export const findAthleteByIdService = (competitionData: CompetitionData, athleteId: string): Athlete | null => {
  for (const club of competitionData.meets[0]?.clubs || []) { // Added optional chaining and fallback
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

// extractRelayService (renamed, logic mostly same)
export const extractRelayService = (competitionData: CompetitionData, eventId: string, heatId: string) => { // Corrected parameter names
  const relayEntries = competitionData.meets[0]?.clubs // Added optional chaining
    ?.map((club: any) => (club.relays || []).map((relay: any) => {
      if (!relay.entries?.length || relay.entries[0].heatid !== heatId || relay.entries[0].eventid !== eventId) {
        return null;
      }
      return {
        lane: relay.entries[0].lane,
        entrytime: relay.entries[0].entrytime,
        club: club.name,
        relayid: relay.relayid,
        athletes: (relay.entries[0].relaypositions || []).map((position: any) => {
          const athlete = findAthleteByIdService(competitionData, position.athleteid); // Use renamed service
          return {
            athleteid: position.athleteid,
            firstname: athlete ? athlete.firstname : '',
            lastname: athlete ? athlete.lastname : '',
          };
        }),
      };
    }));
  type RelayEntryType = { lane: number; entrytime: string; club: string; relayid: string; athletes: any[] };
  const flatRelayEntries = (relayEntries || []) // Handle case where relayEntries might be undefined
    .flat()
    .filter((x: any): x is RelayEntryType => x !== null)
    .sort((a: RelayEntryType, b: RelayEntryType) => a.lane - b.lane);
  return flatRelayEntries;
};

// findAthletesWithoutEntriesService (renamed, logic same)
export function findAthletesWithoutEntriesService(competitionData: CompetitionData) {
  const result = [];
  for (const club of competitionData.meets[0]?.clubs || []) { // Added optional chaining and fallback
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
// Note: readAndProcessCompetitionJSON was effectively replaced by readAndProcessLenexFile and processUploadedFile
// Original handleFileUpload, getMeetSummary, getEvents, getEvent, getHeat, deleteCompetition are to be reimplemented in controller.
// Helper functions like getAthletesByHeatId, findAthleteById, extractRelay, findAthletesWithoutEntries are kept and renamed with _service suffix.
// Added CompetitionError class for better error handling between service and controller.
// Made file paths constants.
// Added optional chaining and fallbacks in various places to prevent runtime errors on unexpected data structures.
// processUploadedFile now handles unlinking the temp file.
// loadCompetitionData is a new helper to centralize reading and parsing competition.json.
// getEventService is reused within getHeatService.
// Renamed eventId and heatId parameters in extractRelayService for clarity (was event, heat).
// Corrected types for Event, Heat, Club etc. to be not explicitly imported if not part of a return type of an exported function.
// Removed unused MulterRequest interface.
// Changed readAndProcessLenexFile to return a Promise for better async handling in controller.
// Ensured all service functions that read competition data use loadCompetitionData.
// Ensured helper services (getAthletesByHeatIdService, etc.) are also exported.
// Made sure that functions like getHeatService return empty array for "not found" sub-entities if that was the implied original logic, rather than throwing an error for sub-entities. Errors are for primary entity not found (e.g. competition file, main event).
// Corrected `extractRelayService` parameters and usage of `findAthleteByIdService`.
// `processUploadedFile` now calls `readAndProcessLenexFile` which returns a promise.
// `deleteCompetitionService` now correctly checks for file existence before unlinking and handles multiple files.
// `getMeetSummaryService` safe access to session date and club count.
// `getEventsService` safe access to events.
// `getEventService` safe access to events.
// `getHeatService` safe access to swimstyle.
// `getAthletesByHeatIdService` safe access to clubs.
// `findAthleteByIdService` safe access to clubs.
// `extractRelayService` safe access to clubs and relaypositions.
// `findAthletesWithoutEntriesService` safe access to clubs.
