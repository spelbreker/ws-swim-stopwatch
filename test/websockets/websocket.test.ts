import { normalizeStartTimestamp } from '../../src/websockets/websocket';

describe('normalizeStartTimestamp', () => {
  it('forwards new format (timestamp_us defined) unchanged', () => {
    const result = normalizeStartTimestamp(1234567890123, 456);
    expect(result.timestamp).toBe(1234567890123);
    expect(result.timestamp_us).toBe(456);
  });

  it('forwards intermediate format (ms, no timestamp_us) with timestamp_us = 0', () => {
    const result = normalizeStartTimestamp(1234567890123, undefined);
    expect(result.timestamp).toBe(1234567890123);
    expect(result.timestamp_us).toBe(0);
  });

  it('converts old format (seconds) to milliseconds and sets timestamp_us = 0', () => {
    const result = normalizeStartTimestamp(1234567890, undefined);
    expect(result.timestamp).toBe(1234567890000);
    expect(result.timestamp_us).toBe(0);
  });

  it('handles timestamp_us = 0 as new format (zero microseconds)', () => {
    const result = normalizeStartTimestamp(1234567890123, 0);
    expect(result.timestamp).toBe(1234567890123);
    expect(result.timestamp_us).toBe(0);
  });

  it('handles boundary: timestamp exactly 10000000000 treated as old format', () => {
    const result = normalizeStartTimestamp(10000000000, undefined);
    expect(result.timestamp).toBe(10000000000000);
    expect(result.timestamp_us).toBe(0);
  });

  it('handles boundary: timestamp just above 10000000000 treated as milliseconds', () => {
    const result = normalizeStartTimestamp(10000000001, undefined);
    expect(result.timestamp).toBe(10000000001);
    expect(result.timestamp_us).toBe(0);
  });
});
