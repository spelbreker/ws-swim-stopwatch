"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const competition_1 = require("../../src/modules/competition");
// Mock fs and parseLenex for readAndProcessCompetitionJSON
jest.mock('fs');
jest.mock('js-lenex/build/src/lenex-parse.js', () => ({
    parseLenex: jest.fn(),
}));
const mockCompetitionData = {
    meets: [
        {
            name: 'Test Meet',
            sessions: [
                {
                    date: '2025-06-01',
                    events: [
                        {
                            number: 1,
                            order: 1,
                            eventid: 'E1',
                            gender: 'M',
                            swimstyle: { relaycount: 1 },
                            heats: [
                                {
                                    heatid: 'H1', number: 1, order: 1, daytime: '10:00',
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
                            athleteid: 'A1',
                            firstname: 'John',
                            lastname: 'Doe',
                            birthdate: '2000-01-01',
                            entries: [
                                {
                                    eventid: 'E1', heatid: 'H1', entrytime: '1:00.00', lane: 3,
                                },
                            ],
                        },
                    ],
                    relays: [
                        {
                            relayid: 'R1',
                            entries: [
                                {
                                    eventid: 'E1',
                                    heatid: 'H1',
                                    entrytime: '2:00.00',
                                    lane: 1,
                                    relaypositions: [
                                        { athleteid: 'A1' },
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
describe('competition module', () => {
    test('getAthletesByHeatId returns correct athlete', () => {
        const result = (0, competition_1.getAthletesByHeatId)(mockCompetitionData, 'H1');
        expect(result).toHaveLength(1);
        expect(result[0].athletes[0].firstname).toBe('John');
        expect(result[0].lane).toBe(3);
    });
    test('findAthleteById finds correct athlete', () => {
        const athlete = (0, competition_1.findAthleteById)(mockCompetitionData, 'A1');
        expect(athlete).toBeDefined();
        expect(athlete?.firstname).toBe('John');
    });
    test('extractRelay returns correct relay entry', () => {
        const relays = (0, competition_1.extractRelay)(mockCompetitionData, 'E1', 'H1');
        expect(relays).toHaveLength(1);
        expect(relays[0].relayid).toBe('R1');
        expect(relays[0].athletes[0].firstname).toBe('John');
    });
    test('readAndProcessCompetitionJSON calls callback with error if fs.readFile fails', (done) => {
        const fs = require('fs');
        fs.readFile.mockImplementation((path, cb) => cb(new Error('fail'), null));
        (0, competition_1.readAndProcessCompetitionJSON)('dummy', (err, result) => {
            expect(err).toBeInstanceOf(Error);
            expect(result).toBeNull();
            done();
        });
    });
    test('readAndProcessCompetitionJSON calls callback with result if parseLenex succeeds', (done) => {
        const fs = require('fs');
        const { parseLenex } = require('js-lenex/build/src/lenex-parse.js');
        fs.readFile.mockImplementation((path, cb) => cb(null, Buffer.from('data')));
        parseLenex.mockResolvedValue(mockCompetitionData);
        fs.writeFileSync.mockImplementation(() => { });
        (0, competition_1.readAndProcessCompetitionJSON)('dummy', (err, result) => {
            expect(err).toBeNull();
            expect(result).toBeDefined();
            expect(result?.meets[0].name).toBe('Test Meet');
            done();
        });
    });
});
describe('getAthletesByHeatId edge cases', () => {
    test('returns empty array if clubs is empty', () => {
        const data = {
            ...mockCompetitionData,
            meets: [{ ...mockCompetitionData.meets[0], clubs: [] }],
        };
        const result = (0, competition_1.getAthletesByHeatId)(data, 'H1');
        expect(result).toEqual([]);
    });
    test('returns empty array if club has no athletes', () => {
        const data = {
            ...mockCompetitionData,
            meets: [{
                    ...mockCompetitionData.meets[0],
                    clubs: [{ name: 'Club B', athletes: [], relays: [] }],
                }],
        };
        const result = (0, competition_1.getAthletesByHeatId)(data, 'H1');
        expect(result).toEqual([]);
    });
    test('returns empty array if club has no athletes property', () => {
        const data = {
            ...mockCompetitionData,
            meets: [{
                    ...mockCompetitionData.meets[0],
                    clubs: [{ name: 'Club C', relays: [] }],
                }],
        };
        const result = (0, competition_1.getAthletesByHeatId)(data, 'H1');
        expect(result).toEqual([]);
    });
    test('returns empty array if athlete has no entries property', () => {
        const data = {
            ...mockCompetitionData,
            meets: [{
                    ...mockCompetitionData.meets[0],
                    clubs: [{
                            name: 'Club D',
                            athletes: [{ athleteid: 'A2', firstname: 'Jane', lastname: 'Smith', birthdate: '2001-01-01' }],
                            relays: [],
                        }],
                }],
        };
        const result = (0, competition_1.getAthletesByHeatId)(data, 'H1');
        expect(result).toEqual([]);
    });
});
