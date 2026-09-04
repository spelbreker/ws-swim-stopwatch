"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitTracker = exports.LENGTHS_PER_SPLIT = void 0;
exports.splitDistanceFor = splitDistanceFor;
exports.computeHeatInfo = computeHeatInfo;
const competition_1 = __importDefault(require("./competition"));
/** The official clocks at one end of the pool, so a split is recorded every two lengths. */
exports.LENGTHS_PER_SPLIT = 2;
function splitDistanceFor(poolLength) {
    return poolLength * exports.LENGTHS_PER_SPLIT;
}
/**
 * Resolve heat information (total distance, expected splits) from competition.json.
 * Falls back to zeros when the competition data or event is unavailable.
 */
function computeHeatInfo(event, heat, session, poolLength) {
    let totalDistance = 0;
    try {
        const found = competition_1.default.getEvent(0, session, event);
        if (found) {
            totalDistance = found.swimstyle.distance * Math.max(1, found.swimstyle.relaycount || 1);
        }
    }
    catch {
        // No competition loaded or invalid session: labels still work, no finish marking
    }
    const expectedSplits = totalDistance > 0 ? Math.ceil(totalDistance / splitDistanceFor(poolLength)) : 0;
    return { event, heat, totalDistance, expectedSplits };
}
/**
 * Tracks per-lane split state for the current heat: cooldown filtering,
 * distance labelling, finish detection and arrival ranking.
 */
class SplitTracker {
    constructor(getSettings) {
        this.getSettings = getSettings;
        this.lanes = new Map();
        this.heat = null;
    }
    getHeat() {
        return this.heat;
    }
    setHeat(info) {
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
    onSplit(lane, timestamp) {
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
    getRanking() {
        return Array.from(this.lanes.entries())
            .filter(([, s]) => s.splitCount > 0)
            .sort(([, a], [, b]) => b.splitCount - a.splitCount || a.lastTimestamp - b.lastTimestamp)
            .map(([lane, s], i) => ({ lane, place: i + 1, splitNumber: s.splitCount }));
    }
}
exports.SplitTracker = SplitTracker;
