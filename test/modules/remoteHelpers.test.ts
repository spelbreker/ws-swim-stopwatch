import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

// Loads a browser ES module from public/ with TypeScript transpilation.
function loadPublicModule(file: string, imports: Record<string, object> = {}, globals: Record<string, unknown> = {}) {
  const filename = path.resolve(__dirname, '../../public', file);
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
    ...globals,
  }, { filename });
  return exports as Record<string, (...args: never[]) => unknown>;
}

// Loads a browser ES module from public/competition/remote.
function loadModule(file: string, imports: Record<string, object> = {}, globals: Record<string, unknown> = {}) {
  return loadPublicModule(`competition/remote/${file}`, imports, globals);
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

describe('formatElapsed', () => {
  const { formatElapsed, formatLapTime } = loadPublicModule('js/modules/format.js') as unknown as {
    formatElapsed: (ms: number) => string;
    formatLapTime: (ts: number, base?: number) => string;
  };

  it('formats an elapsed time as mm:ss:cc', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(18_190)).toBe('00:18:19');
    expect(formatElapsed(61_050)).toBe('01:01:05');
  });

  it('keeps formatLapTime relative to the start and invalid without one', () => {
    expect(formatLapTime(11_000, 10_000)).toBe('00:01:00');
    expect(formatLapTime(11_000)).toBe('---:---:---');
    expect(formatLapTime(9_000, 10_000)).toBe('---:---:---');
  });
});

type Deferred = { promise: Promise<void>; release: () => void };
function deferred(): Deferred {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

function jsonResponse(data: unknown) {
  return { ok: data !== null, json: async () => data };
}

describe('loadHeatViews', () => {
  const entry = (lane: number, lastname: string) => ({
    lane, club: 'Aqua Delta', entrytime: '00:01:20.00', athletes: [{ firstname: 'A', lastname }],
  });
  const event = (number: number, heats: number) => ({
    number, heats: Array.from({ length: heats }, (_, i) => ({ number: i + 1 })), gender: 'M', swimstyle: { distance: 50, relaycount: 1, stroke: 'FREE' },
  });
  const routes: Record<string, unknown> = {
    '/competition/event/1': event(1, 2),
    '/competition/event/2': event(2, 1),
    '/competition/event': [event(1, 2), event(2, 1)],
    '/competition/event/1/heat/1': [entry(1, 'One')],
    '/competition/event/1/heat/2': [entry(2, 'Two')],
    '/competition/event/2/heat/1': [entry(3, 'Three')],
  };

  function setup(fetchImpl?: (url: string) => Promise<unknown>) {
    const els: Record<string, Record<string, unknown>> = {
      'next-heat-title': { textContent: '' },
      'next-heat-list': { replaceChildren: jest.fn(), appendChild: jest.fn() },
      'next-heat-empty': { classList: { add: jest.fn(), remove: jest.fn() } },
    };
    const document = {
      getElementById: (id: string) => els[id] ?? null,
      createElement: () => ({ className: '', textContent: '', append: jest.fn() }),
    };
    const fetch = jest.fn(fetchImpl ?? (async (url: string) => jsonResponse(routes[url] ?? null)));
    const { loadHeatViews } = loadModule('upcoming.js', {
      './eventTitle.js': { formatEventTitle: () => '50m Freestyle Men' },
    }, { document, fetch }) as unknown as {
      loadHeatViews: (e: number | string, h: number | string, s: number | null, o: { onRoster: (l: unknown) => void }) => Promise<void>;
    };
    return { els, fetch, loadHeatViews };
  }

  it('shows the swimmers of the heat and the next heat of the same event', async () => {
    const { els, loadHeatViews } = setup();
    const onRoster = jest.fn();
    await loadHeatViews(1, 1, null, { onRoster });
    expect(onRoster).toHaveBeenCalledWith([expect.objectContaining({ lane: 1, name: 'A One' })]);
    expect(els['next-heat-title'].textContent).toBe('Next heat · event 1 · heat 2 · 50m Freestyle Men');
    expect((els['next-heat-list'].appendChild as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('continues with heat 1 of the next event after the last heat', async () => {
    const { els, loadHeatViews } = setup();
    await loadHeatViews(1, 2, null, { onRoster: jest.fn() });
    expect(els['next-heat-title'].textContent).toBe('Next heat · event 2 · heat 1 · 50m Freestyle Men');
  });

  it('shows no next heat after the last heat of the last event', async () => {
    const { els, loadHeatViews } = setup();
    const onRoster = jest.fn();
    await loadHeatViews(2, 1, null, { onRoster });
    expect(onRoster).toHaveBeenCalledWith([expect.objectContaining({ lane: 3 })]);
    expect(els['next-heat-title'].textContent).toBe('Next heat');
    expect((els['next-heat-empty'].classList as { remove: jest.Mock }).remove).toHaveBeenCalledWith('hidden');
  });

  it('passes null to onRoster when the heat cannot be loaded', async () => {
    const { loadHeatViews } = setup();
    const onRoster = jest.fn();
    await loadHeatViews(9, 1, null, { onRoster });
    expect(onRoster).toHaveBeenCalledWith(null);
  });

  it('drops the result of an earlier selection that answers late', async () => {
    const gate = deferred();
    let slow = true;
    const { loadHeatViews } = setup(async (url) => {
      if (slow) await gate.promise;
      return jsonResponse(routes[url] ?? null);
    });
    const first = jest.fn();
    const second = jest.fn();
    const firstCall = loadHeatViews(1, 1, null, { onRoster: first });
    slow = false;
    await loadHeatViews(2, 1, null, { onRoster: second });
    gate.release();
    await firstCall;
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('updateEventHeatInfoBar', () => {
  it('does not let a late response for an earlier selection overwrite the heat card', async () => {
    const gate = deferred();
    const infoBar = { textContent: '' };
    const kicker = { textContent: '' };
    const document = {
      getElementById: (id: string) => ({ 'event-heat-info-bar': infoBar, 'heat-kicker': kicker } as Record<string, object>)[id] ?? null,
    };
    const fetch = jest.fn(async (url: string) => {
      if (url.includes('/event/1')) await gate.promise;
      const number = url.includes('/event/1') ? 1 : 2;
      return { ok: true, json: async () => ({ number, heats: [{}, {}, {}] }) };
    });
    const { updateEventHeatInfoBar } = loadModule('eventHeat.js', {
      './eventTitle.js': { formatEventTitle: (data: { number: number }) => `Event ${data.number}` },
    }, { document, fetch }) as unknown as {
      updateEventHeatInfoBar: (e: number, h: number, s: number | null) => Promise<void>;
    };
    const first = updateEventHeatInfoBar(1, 1, null);
    await updateEventHeatInfoBar(2, 1, null);
    gate.release();
    await first;
    expect(infoBar.textContent).toBe('Event 2');
    expect(kicker.textContent).toBe('EVENT 2 · HEAT 1 / 3');
  });
});

describe('refreshLiveLog', () => {
  function setup(fetchImpl: (url: string) => Promise<unknown>) {
    const list = { replaceChildren: jest.fn() };
    const els: Record<string, object> = {
      'log-list': list,
      'log-empty': { classList: { toggle: jest.fn() } },
      'log-count': { textContent: '' },
    };
    const document = {
      getElementById: (id: string) => els[id] ?? null,
      createElement: () => ({ className: '', textContent: '', append: jest.fn() }),
    };
    const fetch = jest.fn(fetchImpl);
    const { initLiveLog, refreshLiveLog } = loadModule('liveLog.js', {}, {
      document, fetch, setInterval: jest.fn(), clearInterval: jest.fn(), Date, Number, Promise,
    }) as unknown as { initLiveLog: () => void; refreshLiveLog: () => Promise<void> };
    return { list, fetch, initLiveLog, refreshLiveLog };
  }

  const splitLine = '[2025-06-01T10:00:02.345Z] SPLIT - Lane: 3, Time: 00:18.190, Timestamp: 1';
  const textResponse = (text: string) => ({ ok: true, status: 200, text: async () => text });

  it('runs a call made during a fetch once more after it finishes', async () => {
    const gate = deferred();
    let calls = 0;
    const { fetch, initLiveLog, refreshLiveLog } = setup(async () => {
      calls += 1;
      if (calls === 1) await gate.promise;
      return textResponse(splitLine);
    });
    // initLiveLog starts the first fetch, which waits on the gate.
    initLiveLog();
    const during = refreshLiveLog();
    gate.release();
    await during;
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the shown log on a server error but clears it on 404', async () => {
    let response: unknown = textResponse(splitLine);
    const { list, initLiveLog, refreshLiveLog } = setup(async () => response);
    initLiveLog();
    await new Promise((resolve) => setImmediate(resolve));
    expect(list.replaceChildren).toHaveBeenCalledTimes(1);

    response = { ok: false, status: 503, text: async () => '' };
    await refreshLiveLog();
    expect(list.replaceChildren).toHaveBeenCalledTimes(1);

    response = { ok: false, status: 404, text: async () => '' };
    await refreshLiveLog();
    expect(list.replaceChildren).toHaveBeenCalledTimes(2);
    expect(list.replaceChildren).toHaveBeenLastCalledWith();
  });
});

describe('setCurrentSession', () => {
  it('updates the session number and label without the dialog', () => {
    const indicator = { textContent: '1' };
    const label = { textContent: 'Session 1' };
    const els: Record<string, object> = { 'session-indicator': indicator, 'session-label': label };
    const { setCurrentSession, getCurrentSession } = loadModule('sessionSelector.js', {}, {
      document: { getElementById: (id: string) => els[id] ?? null },
    }) as unknown as { setCurrentSession: (n: number) => void; getCurrentSession: () => number };
    setCurrentSession(2);
    expect(getCurrentSession()).toBe(2);
    expect(indicator.textContent).toBe('2');
    expect(label.textContent).toBe('Session 2');
  });
});
