import Competition from './competition';
import { AppSettings } from './settings';
import type { IgnoredSplitReason } from '../websockets/logger';

/** The official clocks at one end of the pool, so a split is recorded every two lengths. */
export const LENGTHS_PER_SPLIT = 2;

export interface HeatInfo {
  event: number;
  heat: number;
  /** Total race distance in meters (distance * relaycount); 0 when unknown. */
  totalDistance: number;
  /** Number of splits expected before the race is finished; 0 when unknown. */
  expectedSplits: number;
}

export interface RankingEntry {
  lane: number;
  place: number;
  splitNumber: number;
}

export type SplitResult =
  | {
    accepted: true;
    distance: number;
    splitNumber: number;
    isFinish: boolean;
    ranking: RankingEntry[];
  }
  | { accepted: false; reason: IgnoredSplitReason; msSinceLast?: number };

interface LaneState {
  splitCount: number;
  lastTimestamp: number;
  finished: boolean;
}

export function splitDistanceFor(poolLength: number): number {
  return poolLength * LENGTHS_PER_SPLIT;
}

/**
 * Resolve heat information (total distance, expected splits) from competition.json.
 * Falls back to zeros when the competition data or event is unavailable.
 */
export function computeHeatInfo(
  event: number,
  heat: number,
  session: number | undefined,
  poolLength: number,
): HeatInfo {
  let totalDistance = 0;
  try {
    const found = Competition.getEvent(0, session, event);
    if (found) {
      totalDistance = found.swimstyle.distance * Math.max(1, found.swimstyle.relaycount || 1);
    }
  } catch {
    // No competition loaded or invalid session: labels still work, no finish marking
  }
  const expectedSplits = totalDistance > 0 ? Math.ceil(totalDistance / splitDistanceFor(poolLength)) : 0;
  return { event, heat, totalDistance, expectedSplits };
}

/**
 * Tracks per-lane split state for the current heat: cooldown filtering,
 * distance labelling, finish detection and arrival ranking.
 */
export class SplitTracker {
  private lanes = new Map<number, LaneState>();

  private heat: HeatInfo | null = null;

  constructor(private readonly getSettings: () => AppSettings) {}

  getHeat(): HeatInfo | null {
    return this.heat;
  }

  setHeat(info: HeatInfo | null) {
    this.heat = info;
    this.lanes.clear();
  }

  onStart() {
    this.lanes.clear();
  }

  onReset() {
    this.lanes.clear();
    this.heat = null;
  }

  onSplit(lane: number, timestamp: number): SplitResult {
    const { poolLength, splitCooldownSec } = this.getSettings();
    const state = this.lanes.get(lane);

    if (state?.finished) {
      return { accepted: false, reason: 'after-finish' };
    }
    if (state) {
      const msSinceLast = timestamp - state.lastTimestamp;
      if (msSinceLast < splitCooldownSec * 1000) {
        return { accepted: false, reason: 'cooldown', msSinceLast };
      }
    }

    const splitNumber = (state?.splitCount ?? 0) + 1;
    const totalDistance = this.heat?.totalDistance ?? 0;
    const expectedSplits = this.heat?.expectedSplits ?? 0;
    const rawDistance = splitNumber * splitDistanceFor(poolLength);
    const distance = totalDistance > 0 ? Math.min(rawDistance, totalDistance) : rawDistance;
    const isFinish = expectedSplits > 0 && splitNumber >= expectedSplits;

    this.lanes.set(lane, { splitCount: splitNumber, lastTimestamp: timestamp, finished: isFinish });

    return { accepted: true, distance, splitNumber, isFinish, ranking: this.getRanking() };
  }

  /** Lanes with at least one split, ranked by (splitCount desc, lastTimestamp asc). */
  getRanking(): RankingEntry[] {
    return Array.from(this.lanes.entries())
      .filter(([, s]) => s.splitCount > 0)
      .sort(([, a], [, b]) => b.splitCount - a.splitCount || a.lastTimestamp - b.lastTimestamp)
      .map(([lane, s], i) => ({ lane, place: i + 1, splitNumber: s.splitCount }));
  }
}
