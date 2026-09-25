import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

type SocketListener = (event: string, socket: undefined, message?: Record<string, unknown>) => void;

function setupRemote() {
  const classes = new Set(['bg-blue-500']);
  const button = {
    getAttribute: () => '1',
    addEventListener: jest.fn(),
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
  };
  const laneTime = { textContent: '00:00:00' };
  const document = {
    addEventListener: jest.fn(),
    getElementById: jest.fn(() => null),
    querySelector: (selector: string) => selector.startsWith('.lane-time') ? laneTime : button,
    querySelectorAll: (selector: string) => selector === '.lane-button' ? [button] : [laneTime],
  };
  const send = jest.fn();
  const onSocketEvent = jest.fn<void, [SocketListener]>();
  const imports: Record<string, object> = {
    '../js/modules/socket.js': { send, onSocketEvent },
    '../js/modules/timeSync.js': { TimeSync: jest.fn() },
    '../js/modules/format.js': { formatLapTime: () => '00:31:00' },
    '../js/modules/connectionIndicator.js': { setupConnectionIndicator: jest.fn() },
    '../js/modules/wakeLock.js': { requestWakeLock: jest.fn() },
    './remote/eventHeat.js': {
      initEventHeat: () => ({ eventSelect: { value: '3' }, heatSelect: { value: '4' } }),
      fillSelectOptions: jest.fn(),
      updateEventHeatInfoBar: jest.fn(),
    },
    './remote/sessionSelector.js': {
      initSessionSelector: jest.fn(),
      getCurrentSession: () => 1,
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

  imports['./remote/laneButtons.js'] = loadScript('remote/laneButtons.js');
  loadScript('remote.js');
  document.addEventListener.mock.calls.find(([event]) => event === 'DOMContentLoaded')![1]();
  const listener = onSocketEvent.mock.calls[0][0];
  return {
    classes,
    laneTime,
    send,
    emit: (event: string, message?: Record<string, unknown>) => listener(event, undefined, message),
  };
}

describe('competition remote lifecycle', () => {
  let remote: ReturnType<typeof setupRemote>;

  beforeEach(async () => {
    jest.useFakeTimers();
    remote = setupRemote();
    await Promise.resolve();
    await Promise.resolve();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['reset', 'event-heat', 'clear'])('clears the highlight and timer on %s', (type) => {
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    expect(remote.classes.has('bg-green-500')).toBe(true);

    remote.emit('message', { type, event: 3, heat: 4 });
    expect(remote.classes.has('bg-green-500')).toBe(false);
    expect(remote.classes.has('bg-blue-500')).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(12_000);
    expect(remote.classes.has('bg-blue-500')).toBe(true);
  });

  it('does not erase split text when resetting the highlight', () => {
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    remote.emit('message', { type: 'reset' });
    expect(remote.laneTime.textContent).toBe('00:31:00');
  });

  it('keeps a new highlight for its full cooldown after a reset', () => {
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    jest.advanceTimersByTime(1000);
    remote.emit('message', { type: 'reset' });
    remote.emit('message', { type: 'split', lane: 1, timestamp: Date.now() });
    jest.advanceTimersByTime(11_000);
    expect(remote.classes.has('bg-green-500')).toBe(true);
    jest.advanceTimersByTime(1000);
    expect(remote.classes.has('bg-green-500')).toBe(false);
    expect(remote.classes.has('bg-blue-500')).toBe(true);
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
