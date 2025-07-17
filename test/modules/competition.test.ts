import Competition from '../../src/modules/competition';
import {
  CompetitionData,
  CompetitionClub,
  CompetitionAthlete,
  CompetitionMeet,
  Gender,
  Stroke,
} from '../../src/types/competition-types';
import fs from 'fs';

// Mock fs and dynamic import for readAndProcessCompetitionJSON
jest.mock('fs');
const mockParseLenex = jest.fn();
jest.mock('js-lenex/build/src/lenex-parse', () => ({
  parseLenex: (...args: unknown[]): unknown => mockParseLenex(...args),
}));

const mockCompetitionData: CompetitionData = {
  meets: [
    {
      name: 'Test Meet',
      sessions: [
        {
          date: '2025-06-01',
          number: 1,
          events: [
            {
              number: 1,
              order: 1,
              eventid: 'E1',
              gender: Gender.M,
              swimstyle: { relaycount: 1, stroke: Stroke.FREE, distance: 100 },
              heats: [
                {
                  heatid: 'H1',
                  number: 1,
                  order: 1,
                  daytime: '10:00',
                },
              ],
            },
            {
              number: 2,
              order: 2,
              eventid: 'E2',
              gender: Gender.F,
              swimstyle: { relaycount: 4, stroke: Stroke.MEDLEY, distance: 200 },
              heats: [
                {
                  heatid: 'H2',
                  number: 2,
                  order: 1,
                  daytime: '10:30',
                },
              ],
            },
          ],
        },
        {
          date: '2025-06-02',
          number: 2,
          events: [
            {
              number: 3,
              order: 1,
              eventid: 'E3',
              gender: Gender.M,
              swimstyle: { relaycount: 1, stroke: Stroke.BACK, distance: 50 },
              heats: [
                {
                  heatid: 'H3',
                  number: 3,
                  order: 1,
                  daytime: '11:00',
                },
              ],
            },
          ],
        },
      ],
      clubs: [
        {
          name: 'Club A',
          athletes: [
            {
              athleteid: 1,
              firstname: 'John',
              lastname: 'Doe',
              birthdate: '2000-01-01',
              gender: Gender.M,
              entries: [
                {
                  eventid: 'E1',
                  heatid: 'H1',
                  entrytime: '1:00.00',
                  lane: 3,
                },
              ],
            },
            {
              athleteid: 2,
              firstname: 'Jane',
              lastname: 'Smith',
              birthdate: '2001-01-01',
              gender: Gender.F,
              entries: [],
            },
          ],
          relays: [
            {
              relayid: 'R1',
              entries: [
                {
                  eventid: 'E2',
                  heatid: 'H2',
                  entrytime: '2:00.00',
                  lane: 1,
                  relaypositions: [
                    { athleteid: 1 },
                    { athleteid: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function injectCompetitionData(comp: Competition, data: CompetitionData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (comp as any).competitionData = data;
}

describe('Competition class', () => {
  let comp: Competition;
  beforeEach(() => {
    comp = new Competition();
    injectCompetitionData(comp, mockCompetitionData);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockCompetitionData));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getMeetSummary returns correct summary', () => {
    const summary = Competition.getMeetSummary(0, 1); // Use session number 1
    expect(summary.meet).toBe('Test Meet');
    expect(summary.first_session_date).toBe('2025-06-01');
    expect(summary.session_count).toBe(2);
    expect(summary.event_count).toBe(3);
    expect(summary.club_count).toBe(1);
  });

  test('getEvents returns all events for session', () => {
    const events = Competition.getEvents(0, 1); // Use session number 1
    expect(events).toHaveLength(2);
    expect(events[0].eventid).toBe('E1');
    expect(events[1].eventid).toBe('E2');
  });

  test('getEvent returns correct event by number', () => {
    const event = Competition.getEvent(0, 1, 2); // Use session number 1
    expect(event).not.toBeNull();
    expect(event?.eventid).toBe('E2');
  });

  test('getEvent returns null for missing event', () => {
    const event = Competition.getEvent(0, 1, 99); // Use session number 1
    expect(event).toBeNull();
  });

  test('getHeat returns athlete entries for individual event', () => {
    const entries = Competition.getHeat(0, 1, 1, 1); // Use session number 1
    expect(entries).not.toBeNull();
    if (Array.isArray(entries)) {
      expect(entries[0].athletes[0].firstname).toBe('John');
      expect(entries[0].lane).toBe(3);
    } else {
      fail('Expected array of athlete entries');
    }
  });

  test('getHeat returns relay entries for relay event', () => {
    const relays = Competition.getHeat(0, 1, 2, 1); // Use session number 1
    expect(relays).not.toBeNull();
    if (
      Array.isArray(relays)
      && relays.length > 0
      && typeof relays[0] === 'object'
      && relays[0] !== null
      && 'relayid' in relays[0]
    ) {
      expect((relays[0] as { relayid: string }).relayid).toBe('R1');
      expect(relays[0].athletes[0].firstname).toBe('John');
      expect(relays[0].athletes[1].firstname).toBe('Jane');
    } else {
      fail('Expected array of relay entries');
    }
  });

  test('findAthletesWithoutEntries returns athletes with no entries', () => {
    const result = Competition.findAthletesWithoutEntries();
    expect(result).toHaveLength(1);
    expect(result[0].firstname).toBe('Jane');
  });

  test('throws error for invalid indices', () => {
    expect(() => Competition.getMeetSummary(1, 1)).toThrow(); // Invalid meet index
    expect(() => Competition.getMeetSummary(0, 99)).toThrow(); // Invalid session number
  });

  // Session-based tests
  test('getSessions returns all sessions for meet', () => {
    const sessions = Competition.getSessions(0);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].number).toBe(1);
    expect(sessions[1].number).toBe(2);
    expect(sessions[0].date).toBe('2025-06-01');
    expect(sessions[1].date).toBe('2025-06-02');
  });

  test('getSessions throws error for invalid meet index', () => {
    expect(() => Competition.getSessions(1)).toThrow('Invalid meetIndex');
  });

  test('getMeetSummary works with session number', () => {
    const summary = Competition.getMeetSummary(0, 1);
    expect(summary.meet).toBe('Test Meet');
    expect(summary.first_session_date).toBe('2025-06-01');
    expect(summary.session_count).toBe(2);
    expect(summary.event_count).toBe(3); // 2 events in session 1 + 1 event in session 2
    expect(summary.club_count).toBe(1);
  });

  test('getMeetSummary works with different session number', () => {
    const summary = Competition.getMeetSummary(0, 2);
    expect(summary.meet).toBe('Test Meet');
    expect(summary.first_session_date).toBe('2025-06-02'); // Should use session 2's date
    expect(summary.session_count).toBe(2);
  });

  test('getMeetSummary uses first session when no session number provided', () => {
    const summary = Competition.getMeetSummary(0);
    expect(summary.first_session_date).toBe('2025-06-01');
  });

  test('getEvents works with session number', () => {
    const events = Competition.getEvents(0, 1);
    expect(events).toHaveLength(2);
    expect(events[0].eventid).toBe('E1');
    expect(events[1].eventid).toBe('E2');
  });

  test('getEvents works with different session number', () => {
    const events = Competition.getEvents(0, 2);
    expect(events).toHaveLength(1);
    expect(events[0].eventid).toBe('E3');
  });

  test('getEvents uses first session when no session number provided', () => {
    const events = Competition.getEvents(0);
    expect(events).toHaveLength(2);
    expect(events[0].eventid).toBe('E1');
  });

  test('getEvent works with session number', () => {
    const event = Competition.getEvent(0, 1, 2);
    expect(event).not.toBeNull();
    expect(event?.eventid).toBe('E2');
  });

  test('getEvent works with different session number', () => {
    const event = Competition.getEvent(0, 2, 3);
    expect(event).not.toBeNull();
    expect(event?.eventid).toBe('E3');
  });

  test('getEvent returns null for event in wrong session', () => {
    const event = Competition.getEvent(0, 2, 1); // Event 1 is in session 1, not session 2
    expect(event).toBeNull();
  });

  test('getEvent uses first session when no session number provided', () => {
    const event = Competition.getEvent(0, undefined, 1);
    expect(event).not.toBeNull();
    expect(event?.eventid).toBe('E1');
  });

  test('getHeat works with session number', () => {
    const entries = Competition.getHeat(0, 1, 1, 1);
    expect(entries).not.toBeNull();
    if (Array.isArray(entries)) {
      expect(entries[0].athletes[0].firstname).toBe('John');
    }
  });

  test('getHeat uses first session when no session number provided', () => {
    const entries = Competition.getHeat(0, undefined, 1, 1);
    expect(entries).not.toBeNull();
  });

  test('throws error for invalid session number', () => {
    expect(() => Competition.getEvents(0, 99)).toThrow('Session with number 99 not found');
    expect(() => Competition.getEvent(0, 99, 1)).toThrow('Session with number 99 not found');
    expect(() => Competition.getHeat(0, 99, 1, 1)).toThrow('Session with number 99 not found');
  });
});

// Shared type alias for fs.readFile callback signature
type FsReadFileCallback = (err: Error | null, data: Buffer | null) => void;

describe('Competition static readAndProcessCompetitionJSON', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls callback with error if fs.readFile fails', (done) => {
    fs.readFile.mockImplementation((_path: unknown, cb: FsReadFileCallback) => cb(new Error('fail'), null));
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBeInstanceOf(Error);
      expect(result).toBeNull();
      done();
    });
  });

  test('calls callback with error if no meets found', (done) => {
    fs.readFile.mockImplementation((_path: unknown, cb: FsReadFileCallback) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue({ meets: [] });
    fs.writeFileSync.mockImplementation(() => {});
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBe('No meets found');
      expect(result).toBeNull();
      done();
    });
  });

  test('calls callback with error if no sessions found', (done) => {
    fs.readFile.mockImplementation((path: unknown, cb: (err: Error | null, data: Buffer | null) => void) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue({ meets: [{ name: 'X', sessions: [] }] });
    fs.writeFileSync.mockImplementation(() => {});
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBe('No sessions found');
      expect(result).toBeNull();
      done();
    });
  });

  test('calls callback with error if no events found', (done) => {
    fs.readFile.mockImplementation((path: unknown, cb: (err: Error | null, data: Buffer | null) => void) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue({ meets: [{ name: 'X', sessions: [{ date: 'd', events: [] }] }] });
    fs.writeFileSync.mockImplementation(() => {});
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBe('No events found');
      expect(result).toBeNull();
      done();
    });
  });

  test('calls callback with error if no heats found', (done) => {
    fs.readFile.mockImplementation((path: unknown, cb: (err: Error | null, data: Buffer | null) => void) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue({ meets: [{ name: 'X', sessions: [{ date: 'd', events: [{ number: 1, heats: [] }] }] }] });
    fs.writeFileSync.mockImplementation(() => {});
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBe('No heats found');
      expect(result).toBeNull();
      done();
    });
  });

  test('calls callback with error if no clubs found', (done) => {
    fs.readFile.mockImplementation((path: unknown, cb: (err: Error | null, data: Buffer | null) => void) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue({ meets: [{ name: 'X', sessions: [{ date: 'd', events: [{ number: 1, heats: [{}] }] }], clubs: [] }] });
    fs.writeFileSync.mockImplementation(() => {});
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBe('No clubs found');
      expect(result).toBeNull();
      done();
    });
  });

  test('calls callback with result if parseLenex succeeds', (done) => {
    fs.readFile.mockImplementation((path: unknown, cb: (err: Error | null, data: Buffer | null) => void) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue(mockCompetitionData);
    fs.writeFileSync.mockImplementation(() => {});
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBeNull();
      expect(result).toBeDefined();
      if (result && result.meets && result.meets[0]) {
        expect(result.meets[0].name).toBe('Test Meet');
      }
      done();
    });
  });

  test('calls callback with error if writeFileSync throws', (done) => {
    fs.readFile.mockImplementation((path: unknown, cb: (err: Error | null, data: Buffer | null) => void) => cb(null, Buffer.from('data')));
    mockParseLenex.mockResolvedValue(mockCompetitionData);
    fs.writeFileSync.mockImplementation(() => { throw new Error('write fail'); });
    Competition.readAndProcessCompetitionJSON('dummy', (err, result) => {
      expect(err).toBeInstanceOf(Error);
      expect(result).toBeNull();
      done();
    });
  });
});

// Edge case tests for getAthletesByHeatId

describe('getAthletesByHeatId edge cases', () => {
  test('returns empty array if clubs is empty', () => {
    const data = {
      ...mockCompetitionData,
      meets: [{ ...mockCompetitionData.meets[0], clubs: [] }],
    };
    const comp = new Competition();
    injectCompetitionData(comp, data);
    const result = (Competition as unknown as { getAthletesByHeatId: (data: typeof mockCompetitionData, heatId: string) => unknown[] }).getAthletesByHeatId(data, 'H1');
    expect(result).toEqual([]);
  });

  test('returns empty array if club has no athletes', () => {
    const data = {
      ...mockCompetitionData,
      meets: [{
        ...mockCompetitionData.meets[0],
        clubs: [{ name: 'Club B', athletes: [], relays: [] } as CompetitionClub],
      }],
    };
    const comp = new Competition();
    injectCompetitionData(comp, data);
    const result = (Competition as unknown as { getAthletesByHeatId: (data: typeof mockCompetitionData, heatId: string) => unknown[] }).getAthletesByHeatId(data, 'H1');
    expect(result).toEqual([]);
  });

  test('returns empty array if club has no athletes property', () => {
    const data = {
      ...mockCompetitionData,
      meets: [{
        ...mockCompetitionData.meets[0],
        clubs: [{ name: 'Club C', athletes: [], relays: [] } as CompetitionClub],
      }],
    };
    const comp = new Competition();
    injectCompetitionData(comp, data);
    const result = (Competition as unknown as { getAthletesByHeatId: (data: typeof mockCompetitionData, heatId: string) => unknown[] }).getAthletesByHeatId(data, 'H1');
    expect(result).toEqual([]);
  });

  test('returns empty array if athlete has no entries property', () => {
    const data = {
      ...mockCompetitionData,
      meets: [{
        ...mockCompetitionData.meets[0],
        clubs: [{
          name: 'Club D',
          athletes: [{
            athleteid: 2,
            firstname: 'Jane',
            lastname: 'Smith',
            birthdate: '2001-01-01',
            gender: Gender.F,
          } as CompetitionAthlete],
          relays: [],
        } as CompetitionClub],
      }],
    };
    const comp = new Competition();
    injectCompetitionData(comp, data);
    const result = (Competition as unknown as { getAthletesByHeatId: (data: typeof mockCompetitionData, heatId: string) => unknown[] }).getAthletesByHeatId(data, 'H1');
    expect(result).toEqual([]);
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CompetitionMeet = {};
