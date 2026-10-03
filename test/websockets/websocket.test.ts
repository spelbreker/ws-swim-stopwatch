import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { setupWebSocket, resetSplitTracker } from '../../src/websockets/websocket';
import * as logger from '../../src/websockets/logger';
import * as settings from '../../src/modules/settings';
import Competition from '../../src/modules/competition';
import { splashExportDir } from '../../src/modules/splashExport';

const T0 = 1_718_000_000_000;

type Msg = Record<string, unknown>;

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function collect(ws: WebSocket, types: string[]): Msg[] {
  const received: Msg[] = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as Msg;
    if (types.includes(msg.type as string)) received.push(msg);
  });
  return received;
}

const flush = () => new Promise((r) => setTimeout(r, 50));

describe('websocket split handling', () => {
  let server: http.Server;
  let url: string;
  let sender: WebSocket;
  let screen: WebSocket;
  let screenMessages: Msg[];
  const spies: jest.SpyInstance[] = [];
  const originalExportDir = process.env.EXPORT_DIR;

  beforeAll(async () => {
    // Accepted splits write Splash heat files; keep them out of the repo
    process.env.EXPORT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-splash-'));
    server = http.createServer();
    setupWebSocket(server);
    await new Promise<void>((r) => server.listen(0, r));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    fs.rmSync(process.env.EXPORT_DIR!, { recursive: true, force: true });
    if (originalExportDir === undefined) delete process.env.EXPORT_DIR;
    else process.env.EXPORT_DIR = originalExportDir;
  });

  beforeEach(async () => {
    resetSplitTracker();
    fs.rmSync(splashExportDir(), { recursive: true, force: true });
    spies.push(
      jest.spyOn(settings, 'loadSettings').mockReturnValue({ poolLength: 25, splitCooldownSec: 12 }),
      jest.spyOn(logger, 'logSplit').mockImplementation(() => {}),
      jest.spyOn(logger, 'logIgnoredSplit').mockImplementation(() => {}),
      jest.spyOn(logger, 'logStart').mockImplementation(() => {}),
      jest.spyOn(logger, 'logReset').mockImplementation(() => {}),
      jest.spyOn(Competition, 'getEvent').mockReturnValue({
        number: 1, order: 1, eventid: 'e1', gender: 'M', heats: [], swimstyle: { distance: 100, relaycount: 1, stroke: 'FREE' },
      } as unknown as ReturnType<typeof Competition.getEvent>),
    );
    sender = await connect(url);
    screen = await connect(url);
    screenMessages = collect(screen, ['split']);
  });

  afterEach(async () => {
    sender.close();
    screen.close();
    await flush();
    spies.splice(0).forEach((s) => s.mockRestore());
  });

  const send = async (msg: Msg) => {
    sender.send(JSON.stringify(msg));
    await flush();
  };

  it('enriches accepted splits and broadcasts them to all clients', async () => {
    await send({ type: 'event-heat', event: '1', heat: '2' });
    await send({ type: 'start', timestamp: T0, event: '1', heat: '2' });
    await send({ type: 'split', lane: '3', timestamp: T0 + 30_000 });

    expect(screenMessages).toHaveLength(1);
    expect(screenMessages[0]).toMatchObject({
      type: 'split',
      lane: 3,
      timestamp: T0 + 30_000,
      distance: 50,
      splitNumber: 1,
      isFinish: false,
      ranking: [{ lane: 3, place: 1, splitNumber: 1 }],
    });
    expect(screenMessages[0].server_timestamp).toEqual(expect.any(Number));
    expect(logger.logSplit).toHaveBeenCalledWith(3, T0 + 30_000, undefined, 50, 1);
  });

  it('does not broadcast splits within the cooldown and logs them as ignored', async () => {
    await send({ type: 'start', timestamp: T0 });
    await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
    await send({ type: 'split', lane: 3, timestamp: T0 + 30_500 });

    expect(screenMessages).toHaveLength(1);
    expect(logger.logIgnoredSplit).toHaveBeenCalledWith(3, T0 + 30_500, 'cooldown', 500, undefined);
  });

  it('marks the finish and updates ranking for other lanes', async () => {
    await send({ type: 'event-heat', event: 1, heat: 1 });
    await send({ type: 'start', timestamp: T0, event: 1, heat: 1 });
    await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
    await send({ type: 'split', lane: 5, timestamp: T0 + 31_000 });
    await send({ type: 'split', lane: 5, timestamp: T0 + 60_000 });

    expect(screenMessages).toHaveLength(3);
    expect(screenMessages[2]).toMatchObject({
      lane: 5,
      distance: 100,
      splitNumber: 2,
      isFinish: true,
      ranking: [
        { lane: 5, place: 1, splitNumber: 2 },
        { lane: 3, place: 2, splitNumber: 1 },
      ],
    });
  });

  it('start with a new event/heat resets lane state', async () => {
    await send({ type: 'start', timestamp: T0, event: 1, heat: 1 });
    await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
    await send({ type: 'start', timestamp: T0 + 100_000, event: 1, heat: 2 });
    await send({ type: 'split', lane: 3, timestamp: T0 + 120_000 });

    expect(screenMessages).toHaveLength(2);
    expect(screenMessages[1]).toMatchObject({ splitNumber: 1, ranking: [{ lane: 3, place: 1, splitNumber: 1 }] });
  });

  it('relays malformed splits unchanged', async () => {
    await send({ type: 'split', lane: 'x' });
    expect(screenMessages).toHaveLength(1);
    expect(screenMessages[0]).not.toHaveProperty('ranking');
  });

  it('relays splits with non-finite or out-of-range timestamps unchanged', async () => {
    // 1e308 is finite but overflows Date -> toISOString() would throw in the logger
    await send({ type: 'split', lane: 3, timestamp: 1e308 });
    // 1e999 parses to Infinity
    sender.send('{"type":"split","lane":3,"timestamp":1e999}');
    await flush();

    expect(screenMessages).toHaveLength(2);
    screenMessages.forEach((m) => expect(m).not.toHaveProperty('ranking'));
    expect(logger.logSplit).not.toHaveBeenCalled();
  });

  it('relays splits with non-finite lane values unchanged', async () => {
    await send({ type: 'split', lane: 'Infinity', timestamp: T0 + 30_000 });
    expect(screenMessages).toHaveLength(1);
    expect(screenMessages[0]).not.toHaveProperty('ranking');
    expect(logger.logSplit).not.toHaveBeenCalled();
  });

  it('does not log starts with out-of-range timestamps', async () => {
    await send({ type: 'start', timestamp: 1e308, event: 1, heat: 1 });
    expect(logger.logStart).not.toHaveBeenCalled();
  });

  it('falls back to server time for out-of-range reset timestamps', async () => {
    await send({ type: 'reset', timestamp: 1e308 });
    expect(logger.logReset).toHaveBeenCalledTimes(1);
    const ts = (logger.logReset as jest.Mock).mock.calls[0][0] as number;
    expect(Math.abs(ts)).toBeLessThanOrEqual(8.64e15);
  });

  describe('Splash Meet Manager export', () => {
    const heatFile = (name: string) => path.join(splashExportDir(), name);

    it('writes accepted splits with their distance to the heat file', async () => {
      await send({ type: 'event-heat', event: 1, heat: 2, session: 1 });
      await send({ type: 'start', timestamp: T0, event: 1, heat: 2 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 5_000 }); // start-cooldown: ignored
      await send({ type: 'split', lane: 3, timestamp: T0 + 35_220 });
      await send({ type: 'split', lane: 4, timestamp: T0 + 34_990 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 35_500 }); // cooldown: ignored
      await send({ type: 'split', lane: 3, timestamp: T0 + 71_220 });

      expect(fs.readFileSync(heatFile('Event1-Heat2.txt'), 'utf-8'))
        .toBe('LANE;TIME50;TIME100\r\n3;35.22;1:11.22\r\n4;34.99;\r\n');
    });

    it('stops writing after reset', async () => {
      await send({ type: 'start', timestamp: T0, event: 1, heat: 1 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
      await send({ type: 'reset', timestamp: T0 + 40_000 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 60_000 });

      expect(fs.readFileSync(heatFile('Event1-Heat1.txt'), 'utf-8')).toBe('LANE;TIME50\r\n3;30.00\r\n');
    });

    it('stops writing the running heat when event-heat changes before the next start', async () => {
      await send({ type: 'event-heat', event: 1, heat: 1 });
      await send({ type: 'start', timestamp: T0, event: 1, heat: 1 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
      await send({ type: 'event-heat', event: 1, heat: 2 });
      // Tracker restarted its split count: this would otherwise overwrite TIME50 of heat 1
      await send({ type: 'split', lane: 3, timestamp: T0 + 60_000 });

      expect(fs.readFileSync(heatFile('Event1-Heat1.txt'), 'utf-8')).toBe('LANE;TIME50\r\n3;30.00\r\n');
      expect(fs.existsSync(heatFile('Event1-Heat2.txt'))).toBe(false);
    });

    it('keeps writing the running heat when an event-heat with invalid event/heat is ignored', async () => {
      await send({ type: 'event-heat', event: 1, heat: 1 });
      await send({ type: 'start', timestamp: T0, event: 1, heat: 1 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
      await send({ type: 'event-heat', event: '', heat: 1 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 61_000 });

      expect(fs.readFileSync(heatFile('Event1-Heat1.txt'), 'utf-8')).toBe('LANE;TIME50;TIME100\r\n3;30.00;1:01.00\r\n');
    });

    it('leaves lanes outside 0-9 out of the heat file but still broadcasts them', async () => {
      await send({ type: 'event-heat', event: 1, heat: 1 });
      await send({ type: 'start', timestamp: T0, event: 1, heat: 1 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });
      await send({ type: 'split', lane: 12, timestamp: T0 + 31_000 });

      expect(screenMessages.map((m) => m.lane)).toEqual([3, 12]);
      expect(fs.readFileSync(heatFile('Event1-Heat1.txt'), 'utf-8')).toBe('LANE;TIME50\r\n3;30.00\r\n');
    });

    it('does not write a file for a start without event and heat', async () => {
      await send({ type: 'start', timestamp: T0 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });

      expect(fs.existsSync(splashExportDir())).toBe(false);
    });

    it('ignores event/heat values that are not positive integers', async () => {
      await send({ type: 'start', timestamp: T0, event: '../../etc', heat: 1 });
      await send({ type: 'split', lane: 3, timestamp: T0 + 30_000 });

      expect(fs.existsSync(splashExportDir())).toBe(false);
    });
  });
});
