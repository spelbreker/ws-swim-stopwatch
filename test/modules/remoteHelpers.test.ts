import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

// Loads a browser ES module from public/competition/remote with TypeScript transpilation.
function loadModule(file: string, imports: Record<string, object> = {}) {
  const filename = path.resolve(__dirname, '../../public/competition/remote', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const exports: Record<string, never> = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  }, { filename });
  return exports as Record<string, (...args: never[]) => unknown>;
}

describe('laneState', () => {
  const { blockedUntil, describeLane } = loadModule('laneState.js') as unknown as {
    blockedUntil: (lane: object) => number;
    describeLane: (lane: object) => { state: string; status: string; blocked: boolean; progress: number };
  };
  const base = {
    running: true, finished: false, splitCount: 0, remainingMs: 0, cooldownMs: 12000,
  };

  it('blocks until the cooldown after the last split, else after the start', () => {
    expect(blockedUntil({ finished: false, lastSplitTs: 1000, startTs: 0, cooldownMs: 12000 })).toBe(13000);
    expect(blockedUntil({ finished: false, lastSplitTs: null, startTs: 500, cooldownMs: 12000 })).toBe(12500);
    expect(blockedUntil({ finished: false, lastSplitTs: null, startTs: null, cooldownMs: 12000 })).toBe(0);
  });

  it('blocks forever after the finish', () => {
    expect(blockedUntil({ finished: true, lastSplitTs: 1000, startTs: 0, cooldownMs: 12000 })).toBe(Infinity);
  });

  it('describes a lane in timeout with a countdown and progress', () => {
    expect(describeLane({ ...base, remainingMs: 6000 })).toEqual({
      state: 'timeout', status: 'Timeout 6.0s', blocked: true, progress: 50,
    });
  });

  it('describes a swimming lane with its split count and distance', () => {
    expect(describeLane({ ...base, splitCount: 2, distance: 100 })).toMatchObject({
      state: 'swim', status: 'Split 2 · 100m', blocked: false,
    });
    expect(describeLane(base)).toMatchObject({ state: 'swim', status: 'Swimming' });
  });

  it('describes a finished lane with its place', () => {
    expect(describeLane({ ...base, finished: true, place: 2, remainingMs: Infinity })).toMatchObject({
      state: 'finished', status: 'Finish · #2', blocked: true,
    });
  });

  it('describes an idle lane as ready', () => {
    expect(describeLane({ ...base, running: false })).toMatchObject({ state: 'ready', status: 'Ready', blocked: false });
  });
});

describe('formatEventTitle', () => {
  const { formatEventTitle } = loadModule('eventTitle.js') as unknown as {
    formatEventTitle: (event: object) => string;
  };

  it('formats an individual event', () => {
    expect(formatEventTitle({ swimstyle: { distance: 100, relaycount: 1, stroke: 'BREAST' }, gender: 'M' }))
      .toBe('100m Breaststroke Men');
  });

  it('formats a relay event', () => {
    expect(formatEventTitle({ swimstyle: { distance: 50, relaycount: 4, stroke: 'MEDLEY' }, gender: 'F' }))
      .toBe('4x50m Medley Women');
  });

  it('leaves out an unknown gender', () => {
    expect(formatEventTitle({ swimstyle: { distance: 50, relaycount: 1, stroke: 'FREE' } })).toBe('50m Freestyle');
  });
});

describe('entryToLane', () => {
  const { entryToLane } = loadModule('upcoming.js', {
    './eventTitle.js': { formatEventTitle: () => '' },
  }) as unknown as { entryToLane: (entry: object) => object };

  it('maps an individual entry to name and club', () => {
    expect(entryToLane({
      lane: 3, club: 'Aqua Delta', entrytime: '00:01:21.40', athletes: [{ firstname: 'Lars', lastname: 'Jansen' }],
    })).toEqual({ lane: 3, name: 'Lars Jansen', club: 'Aqua Delta', entrytime: '00:01:21.40' });
  });

  it('maps a relay entry to the club and its swimmers', () => {
    expect(entryToLane({
      lane: 2, club: 'De Dolfijn', athletes: [{ lastname: 'Bakker' }, { lastname: 'Kok' }],
    })).toMatchObject({ lane: 2, name: 'De Dolfijn (relay)', club: 'Bakker / Kok' });
  });
});

describe('parseLogLine', () => {
  const { parseLogLine } = loadModule('liveLog.js') as unknown as {
    parseLogLine: (line: string) => { time: string; kind: string; text: string } | null;
  };
  const iso = '2025-06-01T10:00:02.345Z';

  it('parses a start', () => {
    expect(parseLogLine(`[${iso}] START - Event: 12, Heat: 3, Timestamp: 1748772002345`))
      .toMatchObject({ kind: 'START', text: 'Event 12, heat 3' });
  });

  it('parses a reset', () => {
    expect(parseLogLine(`[${iso}] RESET - Timestamp: 1748772002345`))
      .toMatchObject({ kind: 'RESET', text: 'Stopwatch stopped and reset' });
  });

  it('parses a split with distance and split number', () => {
    expect(parseLogLine(`[${iso}] SPLIT - Lane: 3, Time: 00:18.190, Timestamp: 1, Elapsed: 18190ms, Distance: 50m, Split: 1`))
      .toMatchObject({ kind: 'SPLIT', text: 'Lane 3 · 00:18.190 · 50m · split 1' });
  });

  it('parses a split without distance', () => {
    expect(parseLogLine(`[${iso}] SPLIT - Lane: 3, Time: 00:18.190, Timestamp: 1`))
      .toMatchObject({ kind: 'SPLIT', text: 'Lane 3 · 00:18.190' });
  });

  it('parses an ignored split with its reason', () => {
    expect(parseLogLine(`[${iso}] SPLIT IGNORED - Lane: 5, Reason: cooldown, Time: 00:20.100, Timestamp: 1, Since last: 500ms`))
      .toMatchObject({ kind: 'IGNORED', text: 'Lane 5 · split ignored within the cooldown of the previous split' });
    expect(parseLogLine(`[${iso}] SPLIT IGNORED - Lane: 5, Reason: after-finish, Time: 00:20.100, Timestamp: 1`))
      .toMatchObject({ text: 'Lane 5 · split ignored after the finish' });
  });

  it('skips separators, blank lines and invalid dates', () => {
    expect(parseLogLine('=====================')).toBeNull();
    expect(parseLogLine('')).toBeNull();
    expect(parseLogLine('[not a date] SPLIT - Lane: 1')).toBeNull();
  });
});
