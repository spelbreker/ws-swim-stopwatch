import { SplitTracker, computeHeatInfo, HeatInfo } from '../../src/modules/splitTracker';
import Competition from '../../src/modules/competition';
import { AppSettings } from '../../src/modules/settings';

const T0 = 1_718_000_000_000;

function makeTracker(overrides: Partial<AppSettings> = {}) {
  const settings: AppSettings = { poolLength: 25, splitCooldownSec: 12, ...overrides };
  return { tracker: new SplitTracker(() => settings), settings };
}

function heat(totalDistance: number, poolLength = 25): HeatInfo {
  return {
    event: 1,
    heat: 1,
    totalDistance,
    expectedSplits: totalDistance > 0 ? Math.ceil(totalDistance / (poolLength * 2)) : 0,
  };
}

function accepted(result: ReturnType<SplitTracker['onSplit']>) {
  if (!result.accepted) throw new Error(`expected accepted split, got ${result.reason}`);
  return result;
}

describe('SplitTracker', () => {
  describe('cooldown', () => {
    it('accepts the first split, ignores a second within cooldown, accepts a third after it', () => {
      const { tracker } = makeTracker();
      expect(tracker.onSplit(3, T0).accepted).toBe(true);

      const second = tracker.onSplit(3, T0 + 800);
      expect(second).toEqual({ accepted: false, reason: 'cooldown', msSinceLast: 800 });

      const third = accepted(tracker.onSplit(3, T0 + 12_000));
      expect(third.splitNumber).toBe(2);
    });

    it('ignored splits do not advance the cooldown window', () => {
      const { tracker } = makeTracker();
      tracker.onSplit(3, T0);
      tracker.onSplit(3, T0 + 11_000); // ignored
      expect(tracker.onSplit(3, T0 + 12_000).accepted).toBe(true);
    });

    it('is independent per lane', () => {
      const { tracker } = makeTracker();
      tracker.onSplit(3, T0);
      expect(tracker.onSplit(4, T0 + 100).accepted).toBe(true);
    });

    it('reads the cooldown from settings live', () => {
      const settings: AppSettings = { poolLength: 25, splitCooldownSec: 12 };
      const tracker = new SplitTracker(() => settings);
      tracker.onSplit(3, T0);
      expect(tracker.onSplit(3, T0 + 5_000).accepted).toBe(false);
      settings.splitCooldownSec = 4;
      expect(tracker.onSplit(3, T0 + 5_000).accepted).toBe(true);
    });
  });

  describe('distance labels', () => {
    it('labels 50m, 100m, 150m in a 25m pool', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(200));
      const distances = [0, 1, 2].map((i) => accepted(tracker.onSplit(1, T0 + i * 30_000)).distance);
      expect(distances).toEqual([50, 100, 150]);
    });

    it('labels 100m, 200m in a 50m pool', () => {
      const { tracker } = makeTracker({ poolLength: 50 });
      tracker.setHeat(heat(200, 50));
      const distances = [0, 1].map((i) => accepted(tracker.onSplit(1, T0 + i * 60_000)).distance);
      expect(distances).toEqual([100, 200]);
    });

    it('labels raw distance when no heat info is known', () => {
      const { tracker } = makeTracker();
      const result = accepted(tracker.onSplit(1, T0));
      expect(result.distance).toBe(50);
      expect(result.isFinish).toBe(false);
    });

    it('caps the label at the total distance for odd-length races (25m in a 25m pool)', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(25));
      const result = accepted(tracker.onSplit(1, T0));
      expect(result).toMatchObject({ distance: 25, splitNumber: 1, isFinish: true });
    });

    it('caps the label at the total distance for 50m in a 50m pool', () => {
      const { tracker } = makeTracker({ poolLength: 50 });
      tracker.setHeat(heat(50, 50));
      expect(accepted(tracker.onSplit(1, T0))).toMatchObject({ distance: 50, isFinish: true });
    });
  });

  describe('finish detection', () => {
    it('marks isFinish on the expected split for a 100m race in a 25m pool', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(100));
      expect(accepted(tracker.onSplit(1, T0)).isFinish).toBe(false);
      expect(accepted(tracker.onSplit(1, T0 + 30_000)).isFinish).toBe(true);
    });

    it('marks isFinish on split 4 for a 4x50 relay in a 25m pool', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(200));
      const finishes = [0, 1, 2, 3].map((i) => accepted(tracker.onSplit(1, T0 + i * 30_000)).isFinish);
      expect(finishes).toEqual([false, false, false, true]);
    });

    it('ignores splits after finish', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(50));
      tracker.onSplit(1, T0);
      expect(tracker.onSplit(1, T0 + 30_000)).toEqual({ accepted: false, reason: 'after-finish' });
    });

    it('never finishes when expectedSplits is unknown', () => {
      const { tracker } = makeTracker();
      const finishes = [0, 1, 2, 3, 4].map((i) => accepted(tracker.onSplit(1, T0 + i * 30_000)).isFinish);
      expect(finishes.every((f) => f === false)).toBe(true);
    });
  });

  describe('ranking', () => {
    it('ranks by split count first, then earliest timestamp', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(200));
      tracker.onSplit(3, T0);            // lane 3: 1 split
      tracker.onSplit(5, T0 + 1_000);    // lane 5: 1 split, later
      expect(tracker.getRanking()).toEqual([
        { lane: 3, place: 1, splitNumber: 1 },
        { lane: 5, place: 2, splitNumber: 1 },
      ]);

      const result = accepted(tracker.onSplit(5, T0 + 30_000)); // lane 5: 2 splits
      expect(result.ranking).toEqual([
        { lane: 5, place: 1, splitNumber: 2 },
        { lane: 3, place: 2, splitNumber: 1 },
      ]);
    });

    it('includes only lanes that have split', () => {
      const { tracker } = makeTracker();
      tracker.onSplit(2, T0);
      expect(tracker.getRanking()).toEqual([{ lane: 2, place: 1, splitNumber: 1 }]);
    });

    it('does not change the ranking on an ignored split', () => {
      const { tracker } = makeTracker();
      tracker.onSplit(3, T0);
      tracker.onSplit(5, T0 + 1_000);
      tracker.onSplit(5, T0 + 1_500); // ignored
      expect(tracker.getRanking().map((r) => r.lane)).toEqual([3, 5]);
    });
  });

  describe('state lifecycle', () => {
    it('setHeat clears lane state and stores heat info', () => {
      const { tracker } = makeTracker();
      tracker.onSplit(1, T0);
      tracker.setHeat(heat(100));
      expect(tracker.getRanking()).toEqual([]);
      expect(tracker.getHeat()).toEqual(heat(100));
    });

    it('onStart clears lane state but keeps heat info', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(100));
      tracker.onSplit(1, T0);
      tracker.onStart();
      expect(tracker.getRanking()).toEqual([]);
      expect(tracker.getHeat()).toEqual(heat(100));
      expect(tracker.onSplit(1, T0 + 100).accepted).toBe(true);
    });

    it('onReset clears lane state and heat info', () => {
      const { tracker } = makeTracker();
      tracker.setHeat(heat(100));
      tracker.onSplit(1, T0);
      tracker.onReset();
      expect(tracker.getRanking()).toEqual([]);
      expect(tracker.getHeat()).toBeNull();
    });
  });
});

describe('computeHeatInfo', () => {
  let spy: jest.SpyInstance;
  afterEach(() => spy?.mockRestore());

  const event = (distance: number, relaycount: number) => ({
    number: 1, order: 1, eventid: 'e1', gender: 'M', heats: [], swimstyle: { distance, relaycount, stroke: 'FREE' },
  }) as unknown as ReturnType<typeof Competition.getEvent>;

  it('computes total distance and expected splits for an individual event', () => {
    spy = jest.spyOn(Competition, 'getEvent').mockReturnValue(event(100, 1));
    expect(computeHeatInfo(1, 2, undefined, 25)).toEqual({ event: 1, heat: 2, totalDistance: 100, expectedSplits: 2 });
    expect(spy).toHaveBeenCalledWith(0, undefined, 1);
  });

  it('multiplies by relaycount for relays', () => {
    spy = jest.spyOn(Competition, 'getEvent').mockReturnValue(event(50, 4));
    expect(computeHeatInfo(1, 1, 2, 25)).toMatchObject({ totalDistance: 200, expectedSplits: 4 });
    expect(spy).toHaveBeenCalledWith(0, 2, 1);
  });

  it('rounds expected splits up for odd-length races', () => {
    spy = jest.spyOn(Competition, 'getEvent').mockReturnValue(event(25, 1));
    expect(computeHeatInfo(1, 1, undefined, 25)).toMatchObject({ totalDistance: 25, expectedSplits: 1 });
  });

  it('falls back to zeros when the event is not found', () => {
    spy = jest.spyOn(Competition, 'getEvent').mockReturnValue(null);
    expect(computeHeatInfo(9, 1, undefined, 25)).toEqual({ event: 9, heat: 1, totalDistance: 0, expectedSplits: 0 });
  });

  it('falls back to zeros when competition.json is missing', () => {
    spy = jest.spyOn(Competition, 'getEvent').mockImplementation(() => { throw new Error('Missing competition.json'); });
    expect(computeHeatInfo(1, 1, undefined, 25)).toMatchObject({ totalDistance: 0, expectedSplits: 0 });
  });
});
