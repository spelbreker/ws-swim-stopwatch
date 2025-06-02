import fs from 'fs';
import { parseLenex } from 'js-lenex/build/src/lenex-parse.js';
import { Request, Response } from 'express';
import {
  CompetitionData,
  Athlete,
  Club,
  Event,
  Heat,
  Relay,
  RelayEntry,
  RelayPosition
} from './types';

// TypeScript conversion of all functions and exports

// readAndProcessCompetitionJSON
export const readAndProcessCompetitionJSON = (
  filePath: string,
  callback: (err: Error | string | null, result: CompetitionData | null) => void
): void => {
  fs.readFile(filePath, async (err, data) => {
    if (err) {
      callback(err, null);
      return;
    }
    let result = await parseLenex(data);
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

// handleFileUpload
export const handleFileUpload = (req: MulterRequest, res: Response): void => {
  if (!req.file) {
    res.status(400).send('No file uploaded');
    return;
  }
  const filePath = req.file.path;
  readAndProcessCompetitionJSON(filePath, (err, result) => {
    if (err) {
      res.status(500).send('Error reading file - ' + err);
      return;
    }
    fs.unlinkSync(filePath);
    res.redirect('/competition/upload.html');
  });
};

// getMeetSummary
export const getMeetSummary = (req: Request, res: Response): void => {
  let meetIndex = 0;
  let sessionIndex = 0;
  if (req.query.session) sessionIndex = parseInt(req.query.session as string);
  if (req.query.meet) meetIndex = parseInt(req.query.meet as string);
  if (!fs.existsSync('./public/competition.json')) {
    res.status(500).send('Missing competition.json');
    return;
  }
  let competitionData: CompetitionData = JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
  let summary = {
    meet: competitionData.meets[meetIndex].name,
    first_session_date: competitionData.meets[meetIndex].sessions[sessionIndex].date,
    session_count: competitionData.meets[meetIndex].sessions.length,
    event_count: competitionData.meets[meetIndex].sessions.map((session) => session.events.length).reduce((a, b) => a + b, 0),
    club_count: competitionData.meets[meetIndex].clubs.length,
  };
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(summary));
};

// getEvents
export const getEvents = (req: Request, res: Response): void => {
  let meetIndex = 0;
  let sessionIndex = 0;
  if (req.query.session) sessionIndex = parseInt(req.query.session as string);
  if (req.query.meet) meetIndex = parseInt(req.query.meet as string);
  if (!fs.existsSync('./public/competition.json')) {
    res.status(500).send('Missing competition.json');
    return;
  }
  let competitionData: CompetitionData = JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
  let events = competitionData.meets[meetIndex].sessions[sessionIndex].events;
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(events));
};

// getEvent
export const getEvent = (req: Request, res: Response): void => {
  let eventNumber = parseInt(req.params.event);
  let meetIndex = 0;
  let sessionIndex = 0;
  if (req.query.session) sessionIndex = parseInt(req.query.session as string);
  if (req.query.meet) meetIndex = parseInt(req.query.meet as string);
  if (!eventNumber) {
    res.status(400).send('Missing eventNumber');
    return;
  }
  if (!fs.existsSync('./public/competition.json')) {
    res.status(500).send('Missing competition.json');
    return;
  }
  let competitionData: CompetitionData = JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
  let event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);
  if (!event) {
    res.status(404).send('Event not found');
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(event));
};

// getHeat
export const getHeat = (req: Request, res: Response): void => {
  let eventNumber = parseInt(req.params.event);
  let heatNumber = parseInt(req.params.heat);
  let meetIndex = 0;
  let sessionIndex = 0;
  if (req.query.session) sessionIndex = parseInt(req.query.session as string);
  if (req.query.meet) meetIndex = parseInt(req.query.meet as string);
  if (!eventNumber || !heatNumber) {
    res.status(400).send('Missing eventNumber or heatNumber');
    return;
  }
  if (!fs.existsSync('./public/competition.json')) {
    res.status(500).send('Missing competition.json');
    return;
  }
  let competitionData: CompetitionData = JSON.parse(fs.readFileSync('./public/competition.json', 'utf-8'));
  let event = competitionData.meets[meetIndex].sessions[sessionIndex].events.find((event) => event.number === eventNumber);
  if (!event) {
    res.status(404).send('Event not found');
    return;
  }
  let heat = event.heats.find((heat) => heat.number === heatNumber);
  if (!heat) {
    res.status(404).send('Heat not found');
    return;
  }
  if (event.swimstyle.relaycount > 1) {
    let relayEntries = extractRelay(competitionData, event.eventid, heat.heatid);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(relayEntries));
    return;
  }
  let entries = getAthletesByHeatId(competitionData, heat.heatid);
  if (entries.length === 0) {
    res.status(404).send('No entries found for the specified heat');
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(entries));
};

// deleteCompetition
export const deleteCompetition = (req: Request, res: Response): void => {
  fs.unlinkSync('./public/competition.json');
  fs.unlinkSync('./public/events.json');
  fs.unlinkSync('./public/athletes.json');
  res.status(200).send('Competition deleted');
};

// getAthletesByHeatId
export const getAthletesByHeatId = (competitionData: CompetitionData, heatId: string) => {
  let entries = competitionData.meets[0].clubs
    .map((club) => {
      return (club.athletes || []).map((athlete) => {
        if (!Array.isArray(athlete.entries)) {
          return null;
        }
        let filterResult = athlete.entries.filter((entry) => entry.heatid === heatId);
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
      });
    });
  // Flatten, filter nulls with type guard, and sort
  type EntryType = { lane: number; entrytime: string; club: string; athletes: any[] };
  const flatEntries = entries.flat().filter((x): x is EntryType => x !== null).sort((a, b) => a.lane - b.lane);
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
  let relayEntries = competitionData.meets[0].clubs
    .map((club) => {
      return (club.relays || []).map((relay) => {
        if (!relay.entries.length || relay.entries[0].heatid !== heat || relay.entries[0].eventid !== event) {
          return null;
        }
        return {
          lane: relay.entries[0].lane,
          entrytime: relay.entries[0].entrytime,
          club: club.name,
          relayid: relay.relayid,
          athletes: relay.entries[0].relaypositions.map((position) => {
            let athlete = findAthleteById(competitionData, position.athleteid);
            return {
              athleteid: position.athleteid,
              firstname: athlete ? athlete.firstname : '',
              lastname: athlete ? athlete.lastname : '',
            };
          }),
        };
      });
    });
  // Flatten, filter nulls with type guard, and sort
  type RelayEntryType = { lane: number; entrytime: string; club: string; relayid: string; athletes: any[] };
  const flatRelayEntries = relayEntries.flat().filter((x): x is RelayEntryType => x !== null).sort((a, b) => a.lane - b.lane);
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
            birthdate: athlete.birthdate
          });
        }
      }
    }
  }
  return result;
}
