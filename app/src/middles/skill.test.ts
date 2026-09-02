import { describe, expect, it } from 'vitest';
import type { HarmonyKind } from '../../../engine/harmony';
import { hitRates, mergeSkill, solvedAtLevel, weakestKind, weeklyHitTrend } from './skill';
import type { SkillRecord } from './skill';

let n = 0;
const rec = (kind: HarmonyKind, solved: boolean, t = Date.UTC(2026, 8, 1) + n * 3_600_000, mode: 'daily' | 'practice' = 'practice', level = 1): SkillRecord => ({
  id: `r${n++}`,
  t,
  mode,
  level,
  kind,
  solved,
  tries: solved ? 1 : 3,
});

describe('hit rate per mean', () => {
  it('counts solved over seen inside the window, per kind', () => {
    const records = [rec('arithmetic', true), rec('arithmetic', false), rec('musical', true)];
    const rates = hitRates(records);
    expect(rates).toEqual([
      { kind: 'arithmetic', n: 2, rate: 0.5 },
      { kind: 'geometric', n: 0, rate: null },
      { kind: 'musical', n: 1, rate: 1 },
    ]);
  });

  it('the window is the last fifty puzzles overall, not per kind', () => {
    const old = Array.from({ length: 40 }, () => rec('arithmetic', false));
    const recent = Array.from({ length: 50 }, () => rec('geometric', true));
    const rates = hitRates([...old, ...recent]);
    expect(rates[0]).toEqual({ kind: 'arithmetic', n: 0, rate: null });
    expect(rates[1]).toEqual({ kind: 'geometric', n: 50, rate: 1 });
  });

  it('names the kind that lags, prefers the one with too little evidence', () => {
    expect(weakestKind([])).toBe('arithmetic');
    const seen = [...Array.from({ length: 5 }, () => rec('arithmetic', true)), ...Array.from({ length: 5 }, () => rec('geometric', true)), rec('musical', true)];
    expect(weakestKind(seen)).toBe('musical');
    const all = [
      ...Array.from({ length: 10 }, () => rec('arithmetic', true)),
      ...Array.from({ length: 10 }, (_, i) => rec('geometric', i < 8)),
      ...Array.from({ length: 10 }, (_, i) => rec('musical', i < 4)),
    ];
    expect(weakestKind(all)).toBe('musical');
    const level = [
      ...Array.from({ length: 10 }, (_, i) => rec('arithmetic', i < 9)),
      ...Array.from({ length: 10 }, (_, i) => rec('geometric', i < 8)),
      ...Array.from({ length: 10 }, (_, i) => rec('musical', i < 9)),
    ];
    expect(weakestKind(level)).toBeNull();
  });

  it('buckets the trend by week and kind', () => {
    const monday = Date.UTC(2026, 8, 7); // 2026-09-07 is a Monday
    const records = [rec('musical', true, monday), rec('musical', false, monday + 2 * 86_400_000), rec('arithmetic', true, monday + 8 * 86_400_000)];
    const trend = weeklyHitTrend(records);
    expect(trend.map((w) => w.weekStart)).toEqual([monday, monday + 7 * 86_400_000]);
    expect(trend[0]!.byKind.musical).toEqual({ n: 2, solved: 1 });
    expect(trend[1]!.byKind.arithmetic).toEqual({ n: 1, solved: 1 });
    expect(trend[1]!.byKind.musical).toEqual({ n: 0, solved: 0 });
  });

  it('counts solved practice puzzles per level, the daily not among them', () => {
    const records = [rec('arithmetic', true, undefined, 'practice', 2), rec('arithmetic', false, undefined, 'practice', 2), rec('arithmetic', true, undefined, 'daily', 0)];
    expect(solvedAtLevel(records, 2)).toBe(1);
    expect(solvedAtLevel(records, 0)).toBe(0);
  });
});

describe('merging device and server records', () => {
  it('unites by id, marks everything present as synced, keeps the local copy', () => {
    const local = [rec('arithmetic', true), { ...rec('geometric', false), id: 'shared' }];
    const remote = [{ ...rec('geometric', true), id: 'shared', t: 1 }, rec('musical', true, 5)];
    const merged = mergeSkill(local, remote);
    expect(merged.map((r) => r.id)).toEqual([...new Set(merged.map((r) => r.id))]);
    expect(merged).toHaveLength(3);
    const shared = merged.find((r) => r.id === 'shared')!;
    expect(shared.solved).toBe(false); // local wins
    expect(shared.synced).toBe(true);
    expect(merged.find((r) => r.id === local[0]!.id)!.synced).toBe(false);
    expect(merged.map((r) => r.t)).toEqual([...merged.map((r) => r.t)].sort((a, b) => a - b));
  });
});
