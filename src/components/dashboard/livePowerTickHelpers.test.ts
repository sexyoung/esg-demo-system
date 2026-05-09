import { describe, expect, it } from 'vitest';
import { capPausedBuffer, formatTimeRange, mergePausedBuffer } from './livePowerTickHelpers';

describe('mergePausedBuffer', () => {
  it('appends paused entries to data arrays', () => {
    const ts = [1, 2, 3];
    const kw = [10, 20, 30];
    const buf: Array<[number, number]> = [[4, 40], [5, 50]];
    mergePausedBuffer(ts, kw, buf, 100);
    expect(ts).toEqual([1, 2, 3, 4, 5]);
    expect(kw).toEqual([10, 20, 30, 40, 50]);
  });

  it('trims oldest entries when result exceeds maxPoints', () => {
    const ts = [1, 2, 3];
    const kw = [10, 20, 30];
    const buf: Array<[number, number]> = [[4, 40], [5, 50], [6, 60]];
    mergePausedBuffer(ts, kw, buf, 4);
    expect(ts).toEqual([3, 4, 5, 6]);
    expect(kw).toEqual([30, 40, 50, 60]);
  });

  it('handles empty paused buffer (no-op)', () => {
    const ts = [1, 2];
    const kw = [10, 20];
    mergePausedBuffer(ts, kw, [], 100);
    expect(ts).toEqual([1, 2]);
    expect(kw).toEqual([10, 20]);
  });

  it('handles empty data with non-empty buffer', () => {
    const ts: number[] = [];
    const kw: number[] = [];
    mergePausedBuffer(ts, kw, [[1, 10], [2, 20]], 100);
    expect(ts).toEqual([1, 2]);
    expect(kw).toEqual([10, 20]);
  });
});

describe('capPausedBuffer', () => {
  it('returns buffer unchanged when under cap', () => {
    const buf: Array<[number, number]> = [[1, 10], [2, 20]];
    capPausedBuffer(buf, 5);
    expect(buf).toEqual([[1, 10], [2, 20]]);
  });

  it('FIFO-drops oldest entries when over cap', () => {
    const buf: Array<[number, number]> = [[1, 10], [2, 20], [3, 30], [4, 40]];
    capPausedBuffer(buf, 2);
    expect(buf).toEqual([[3, 30], [4, 40]]);
  });

  it('handles cap exactly equal to length (no drop)', () => {
    const buf: Array<[number, number]> = [[1, 10], [2, 20]];
    capPausedBuffer(buf, 2);
    expect(buf).toEqual([[1, 10], [2, 20]]);
  });
});

describe('formatTimeRange', () => {
  it('formats 10-minute range', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 5) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 33, 5) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('10m');
    expect(result).toContain('–');
  });

  it('formats sub-minute range with seconds', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 5) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 23, 28) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('23s');
  });

  it('formats minute+second range', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 5) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 24, 35) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('1m 30s');
  });

  it('formats whole-minute range without seconds suffix', () => {
    const min = Date.UTC(2026, 4, 9, 14, 23, 0) / 1000;
    const max = Date.UTC(2026, 4, 9, 14, 28, 0) / 1000;
    const result = formatTimeRange(min, max);
    expect(result).toContain('5m');
    expect(result).not.toContain('5m 0s');
  });
});
