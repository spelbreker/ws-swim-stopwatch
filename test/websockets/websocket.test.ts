import http from 'http';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { setupWebSocket, resetSplitTracker } from '../../src/websockets/websocket';
import * as logger from '../../src/websockets/logger';
import * as settings from '../../src/modules/settings';
import Competition from '../../src/modules/competition';

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

  beforeAll(async () => {
    server = http.createServer();
    setupWebSocket(server);
    await new Promise<void>((r) => server.listen(0, r));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  beforeEach(async () => {
    resetSplitTracker();
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
    expect(logger.logIgnoredSplit).toHaveBeenCalledWith(3, T0 + 30_500, 'cooldown', 500);
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
    await send({ type: 'split', lane: 3, timestamp: T0 + 100_500 });

    expect(screenMessages).toHaveLength(2);
    expect(screenMessages[1]).toMatchObject({ splitNumber: 1, ranking: [{ lane: 3, place: 1, splitNumber: 1 }] });
  });

  it('relays malformed splits unchanged', async () => {
    await send({ type: 'split', lane: 'x' });
    expect(screenMessages).toHaveLength(1);
    expect(screenMessages[0]).not.toHaveProperty('ranking');
  });
});
