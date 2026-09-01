import { describe, expect, it } from 'vitest';
import { formatWeek, weeklyTrend, weekStart, windowAverage } from './coverage';

const day = 86_400_000;

describe('coverage trend', () => {
  it('window average over the last 50 moves', () => {
    expect(windowAverage([])).toBeNull();
    const records = Array.from({ length: 60 }, (_, i) => ({ t: i * day, coverage: i < 10 ? 0 : 1, assist: 0 }));
    expect(windowAverage(records)).toBe(1);
    expect(windowAverage(records, 60)).toBeCloseTo(50 / 60);
  });

  it('weeks start on Monday, UTC', () => {
    const wed = Date.UTC(2026, 8, 2, 15); // Wednesday 2026-09-02
    expect(new Date(weekStart(wed)).toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(formatWeek(weekStart(wed))).toBe('31.08.');
    const mon = Date.UTC(2026, 7, 31, 0);
    expect(weekStart(mon)).toBe(mon);
  });

  it('buckets by week, oldest first', () => {
    const w1 = Date.UTC(2026, 7, 31);
    const w2 = Date.UTC(2026, 8, 7);
    const trend = weeklyTrend([
      { t: w2 + day, coverage: 1, assist: 0 },
      { t: w1 + day, coverage: 0.5, assist: 0 },
      { t: w1 + 2 * day, coverage: 1, assist: 0 },
    ]);
    expect(trend).toEqual([
      { weekStart: w1, moves: 2, average: 0.75 },
      { weekStart: w2, moves: 1, average: 1 },
    ]);
  });
});
