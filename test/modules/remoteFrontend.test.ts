import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

type SocketListener = (event: string, socket: undefined, message?: Record<string, unknown>) => void;

function setupRemote({ sessionsReady = Promise.resolve(), eventsReady = Promise.resolve(), session = 1, firstEvent = '1' } = {}) {
  const eventSelect = { id: 'event-select', value: '', options: [{ value: firstEvent }] };
  const heatSelect = { id: 'heat-select', value: '' };
  const fillSelectOptions = jest.fn(async (select: { id: string; value: string }) => {
    if (select.id === 'event-select') await eventsReady;
    select.value = select.id === 'event-select' ? firstEvent : '1';
  });
  const updateEventHeatInfoBar = jest.fn();
  const laneTime = { textContent: '--:--:--' };
  const laneStatus = { textContent: '' };
  const clicks: Array<() => void> = [];
  const row = {
    dataset: {} as Record<string, string>,
    getAttribute: () => '1',
    setAttribute: jest.fn(),
    addEventListener: (_event: string, handler: () => void) => clicks.push(handler),
    querySelector: (selector: string) => {
      if (selector === '.lane-time') return laneTime;
      if (selector === '.lane-status') return laneStatus;
      return { textContent: '', style: {} };
    },
  };
  const key = {
    getAttribute: () => '1', addEventListener: jest.fn(), setAttribute: jest.fn(), disabled: false,
  };
  const lastRowState = () => row.dataset.state;
  const document = {
    addEventListener: jest.fn(),
    getElementById: jest.fn(() => null),
    querySelector: () => null,
    querySelectorAll: (selector: string) => {
      if (selector === '.lane-row') return [row];
      if (selector === '.lane-button') return [key];
      return [];
    },
  };
  const send = jest.fn();
  const refreshLiveLog = jest.fn();
  const onSocketEvent = jest.fn<void, [SocketListener]>();
  const imports: Record<string, object> = {
    '../js/modules/socket.js': { send, onSocketEvent },
    '../js/modules/timeSync.js': { TimeSync: jest.fn() },
    '../js/modules/format.js': { formatLapTime: () => '00:31:00', pad: (n: number) => String(n).padStart(2, '0') },
    '../../js/modules/format.js': { formatLapTime: () => '00:31:00' },
    '../js/modules/connectionIndicator.js': { setupConnectionIndicator: jest.fn() },
    '../js/modules/wakeLock.js': { requestWakeLock: jest.fn() },
    './remote/eventHeat.js': {
      initEventHeat: () => ({ eventSelect, heatSelect }),
      fillSelectOptions,
      updateEventHeatInfoBar,
      onHeatDisplayed: jest.fn(),
    },
    './remote/upcoming.js': { loadHeatViews: jest.fn() },
    './remote/liveLog.js': { initLiveLog: jest.fn(), refreshLiveLog },
    './remote/keysMode.js': { initKeysMode: jest.fn() },
    './remote/tabs.js': { initTabs: jest.fn() },
    './remote/sessionSelector.js': {
      initSessionSelector: () => sessionsReady,
      getCurrentSession: () => session,
    },
  };

  function loadScript(relativePath: string) {
    const filename = path.resolve(__dirname, '../../public/competition', relativePath);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      fileName: filename,
    });
    const exports = {};
    vm.runInNewContext(outputText, {
      exports,
      require: (name: string) => {
        if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
        return imports[name];
      },
      document,
      console: { log: jest.fn(), warn: jest.fn() },
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ splitCooldownSec: 12 }),
      }),
      Date,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    }, { filename });
    return exports;
  }

  imports['./laneState.js'] = loadScript('remote/laneState.js');
  imports['./remote/laneButtons.js'] = loadScript('remote/laneButtons.js');
  loadScript('remote.js');
  document.addEventListener.mock.calls.find(([event]) => event === 'DOMContentLoaded')![1]();
  const listener = onSocketEvent.mock.calls[0][0];
  return {
    lastRowState,
    rowDataset: row.dataset,
    setRoster: (entries: unknown) => (imports['./remote/laneButtons.js'] as { setRoster: (e: unknown) => void }).setRoster(entries),
    refreshLiveLog,
    clickRow: () => clicks.forEach((handler) => handler()),
    laneTime,
    laneStatus,
    send,
    eventSelect,
    heatSelect,
    fillSelectOptions,
    updateEventHeatInfoBar,
    pressEnter: () => document.addEventListener.mock.calls.find(([event]) => event === 'keydown')![1]({ key: 'Enter' }),
    emit: (event: string, message?: Record<string, unknown>) => listener(event, undefined, message),
  };
}

describe('competition remote lifecycle', () => {
  let remote: ReturnType<typeof setupRemote>;

  beforeEach(async () => {
    jest.useFakeTimers();
    remote = setupRemote();
    await jest.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('blocks a lane in timeout after a split and frees it after the cooldown', async () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() - 30_000 });
    expect(remote.lastRowState()).toBe('swim');

    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now(), splitNumber: 1, distance: 50 });
    expect(remote.lastRowState()).toBe('timeout');
    expect(remote.laneTime.textContent).toBe('00:31:00');
    expect(remote.laneStatus.textContent).toMatch(/^Timeout 12\.0s$/);

    await jest.advanceTimersByTimeAsync(11_900);
    expect(remote.lastRowState()).toBe('timeout');
    await jest.advanceTimersByTimeAsync(200);
    expect(remote.lastRowState()).toBe('swim');
    expect(remote.laneStatus.textContent).toBe('Split 1 · 50m');
  });

  it('shows every lane in timeout right after the start, like the server does', () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() });
    expect(remote.lastRowState()).toBe('timeout');
  });

  it('still sends a tap on a lane in timeout so the server logs it as ignored, then refreshes the log', async () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() });
    remote.refreshLiveLog.mockClear();
    remote.clickRow();
    expect(remote.send).toHaveBeenCalledWith({ type: 'split', lane: 1, timestamp: Date.now() });
    await jest.advanceTimersByTimeAsync(300);
    expect(remote.refreshLiveLog).toHaveBeenCalledTimes(1);
  });

  it('sends a split when a free lane row is tapped', () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() - 30_000 });
    remote.clickRow();
    expect(remote.send).toHaveBeenCalledWith({ type: 'split', lane: 1, timestamp: Date.now() });
  });

  it('keeps a lane without a registered swimmer usable', () => {
    remote.setRoster([{ lane: 2, name: 'Sem Bakker', club: 'De Dolfijn' }]);
    expect(remote.rowDataset.unassigned).toBe('true');
    remote.emit('message', { type: 'start', timestamp: Date.now() - 30_000 });
    expect(remote.lastRowState()).toBe('swim');
    remote.clickRow();
    expect(remote.send).toHaveBeenCalledWith({ type: 'split', lane: 1, timestamp: Date.now() });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    expect(remote.lastRowState()).toBe('timeout');
  });

  it('marks a lane finished and keeps it blocked', () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() - 60_000 });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now(), splitNumber: 2, isFinish: true, ranking: [{ lane: 1, place: 1, splitNumber: 2 }] });
    expect(remote.lastRowState()).toBe('finished');
    expect(remote.laneStatus.textContent).toBe('Finish · #1');
    jest.advanceTimersByTime(60_000);
    expect(remote.lastRowState()).toBe('finished');
  });

  it.each(['reset', 'event-heat', 'clear'])('clears the timeout and its timer on %s', (type) => {
    remote.emit('message', { type: 'start', timestamp: Date.now() - 30_000 });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    expect(remote.lastRowState()).toBe('timeout');

    remote.emit('message', { type, event: 3, heat: 4 });
    expect(remote.lastRowState()).toBe(type === 'reset' ? 'ready' : 'swim');
    expect(remote.laneTime.textContent).toBe('--:--:--');
    expect(jest.getTimerCount()).toBe(type === 'reset' ? 0 : 1);
  });

  it('keeps a new timeout for its full cooldown after a reset', () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() - 30_000 });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    jest.advanceTimersByTime(1000);
    remote.emit('message', { type: 'reset' });
    remote.emit('message', { type: 'start', timestamp: Date.now() - 30_000 });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    jest.advanceTimersByTime(11_000);
    expect(remote.lastRowState()).toBe('timeout');
    jest.advanceTimersByTime(1000);
    expect(remote.lastRowState()).toBe('swim');
  });

  it('refreshes the live log on start, split and reset', () => {
    remote.emit('message', { type: 'start', timestamp: Date.now() });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() + 30_000 });
    remote.emit('message', { type: 'reset' });
    expect(remote.refreshLiveLog).toHaveBeenCalledTimes(3);
  });

  it('preserves the selection and info bar across repeated reconnects', async () => {
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(0);
    remote.emit('message', { type: 'event-heat', event: '3', heat: '4', session: 1 });
    remote.updateEventHeatInfoBar.mockClear();
    remote.fillSelectOptions.mockClear();

    for (let i = 0; i < 3; i++) {
      remote.emit('close');
      remote.emit('open');
      await jest.advanceTimersByTimeAsync(0);
      expect(remote.eventSelect.value).toBe('3');
      expect(remote.heatSelect.value).toBe('4');
    }
    expect(remote.fillSelectOptions).not.toHaveBeenCalled();
    expect(remote.updateEventHeatInfoBar).not.toHaveBeenCalled();
    expect(remote.send).not.toHaveBeenCalled();
  });

  it('starts with the preserved event and heat after reconnect', async () => {
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(0);
    remote.emit('message', { type: 'event-heat', event: '3', heat: '4' });
    remote.emit('close');
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(0);
    remote.pressEnter();
    expect(remote.send).toHaveBeenCalledWith({ type: 'start', event: '3', heat: '4', timestamp: Date.now() });
  });

  it('does not change selection or send race commands when reconnecting during a race', async () => {
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(0);
    remote.emit('message', { type: 'event-heat', event: '3', heat: '4' });
    remote.emit('message', { type: 'start', timestamp: Date.now() });
    remote.emit('close');
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(100);
    expect(remote.eventSelect.value).toBe('3');
    expect(remote.heatSelect.value).toBe('4');
    expect(remote.send).not.toHaveBeenCalled();
    // stopwatch, ping interval and the start-timeout countdown of the lane row
    expect(jest.getTimerCount()).toBe(3);
  });

  it('waits for the session before initializing dropdowns, independently of socket opens', async () => {
    let finishSessions!: () => void;
    remote = setupRemote({
      sessionsReady: new Promise<void>((resolve) => { finishSessions = resolve; }),
      session: 2,
      firstEvent: '7',
    });
    remote.emit('open');
    remote.emit('close');
    remote.emit('open');
    expect(remote.fillSelectOptions).not.toHaveBeenCalled();
    finishSessions();
    await jest.advanceTimersByTimeAsync(0);
    expect(remote.fillSelectOptions).toHaveBeenCalledTimes(2);
    expect(remote.fillSelectOptions).toHaveBeenCalledWith(remote.eventSelect, 25, 2);
    expect(remote.eventSelect.value).toBe('7');
    expect(remote.heatSelect.value).toBe('1');
    expect(remote.updateEventHeatInfoBar).toHaveBeenLastCalledWith('7', '1', 2);
    expect(remote.send).not.toHaveBeenCalled();
  });

  it('does not duplicate a pending event load and updates the info bar only when it finishes', async () => {
    let finishEvents!: () => void;
    remote = setupRemote({
      eventsReady: new Promise<void>((resolve) => { finishEvents = resolve; }),
      firstEvent: '7',
    });
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(0);
    remote.emit('close');
    remote.emit('open');
    await jest.advanceTimersByTimeAsync(0);
    expect(remote.updateEventHeatInfoBar).not.toHaveBeenCalled();
    finishEvents();
    await jest.advanceTimersByTimeAsync(0);
    expect(remote.fillSelectOptions).toHaveBeenCalledTimes(2);
    expect(remote.updateEventHeatInfoBar).toHaveBeenCalledTimes(1);
    expect(remote.updateEventHeatInfoBar).toHaveBeenLastCalledWith('7', '1', 1);
  });

  it('initializes options even before the first socket opens', () => {
    expect(remote.eventSelect.value).toBe('1');
    expect(remote.heatSelect.value).toBe('1');
    expect(remote.send).not.toHaveBeenCalled();
  });

  it('sends five initial pings followed by one ping every five seconds', () => {
    remote.emit('open');
    jest.advanceTimersByTime(2500);
    expect(remote.send).toHaveBeenCalledTimes(5);
    expect(remote.send).toHaveBeenLastCalledWith({ type: 'ping', time: Date.now() });
    remote.send.mockClear();
    jest.advanceTimersByTime(15_000);
    expect(remote.send).toHaveBeenCalledTimes(3);
  });

  it.each([1000, 2500])('stops pinging when disconnected after %i ms', (delay) => {
    remote.emit('open');
    jest.advanceTimersByTime(delay);
    remote.emit('close');
    remote.send.mockClear();
    jest.advanceTimersByTime(20_000);
    expect(remote.send).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps one ping interval across repeated reconnects', () => {
    remote.emit('open');
    jest.advanceTimersByTime(2500);
    for (let i = 0; i < 3; i++) {
      remote.emit('close');
      jest.advanceTimersByTime(1000);
      remote.emit('open');
      jest.advanceTimersByTime(2500);
      remote.send.mockClear();
      jest.advanceTimersByTime(15_000);
      expect(remote.send).toHaveBeenCalledTimes(3);
      expect(jest.getTimerCount()).toBe(1);
    }
  });

  it('restarts initial sync without duplicating timers on consecutive open events', () => {
    remote.emit('open');
    jest.advanceTimersByTime(1000);
    remote.emit('open');
    remote.send.mockClear();
    jest.advanceTimersByTime(2500);
    expect(remote.send).toHaveBeenCalledTimes(5);
    expect(jest.getTimerCount()).toBe(1);
  });
});
