import { describe, expect, it } from 'vitest';
import { CHAIN_MIN, CHAIN_SIZE, canLay, chainShareText, generateChain, linkKind, longestChain, verifyChain } from './chain';
import { isoDate } from './middles';

describe('the chain', () => {
  it('links: every three in a row a harmony, ascending', () => {
    expect(linkKind([2, 4], 6)).toBe('arithmetic');
    expect(linkKind([4, 6], 9)).toBe('geometric');
    expect(linkKind([12, 16], 24)).toBe('musical');
    expect(linkKind([2, 4], 7)).toBeNull();
    expect(canLay([], 5)).toBe(true);
    expect(canLay([5], 3)).toBe(false); // must ascend
    expect(canLay([5], 8)).toBe(true); // the second number is free
    expect(canLay([2, 4], 6)).toBe(true);
    expect(canLay([2, 4], 5)).toBe(false);
  });

  it('finds the longest chain by search', () => {
    const r = longestChain([2, 4, 6, 9, 12, 16, 24, 48, 5, 7, 11, 13]);
    expect(r.length).toBe(8);
    expect(r.chain).toEqual([2, 4, 6, 9, 12, 16, 24, 48]);
    expect(longestChain([3, 5, 7]).length).toBe(3);
    expect(longestChain([3, 5, 8]).length).toBe(2);
  });

  it('a season of chains: deterministic, twelve numbers, at least five links, verified', () => {
    for (let i = 0; i < 60; i++) {
      const date = isoDate(Date.parse('2026-09-01T00:00:00Z') + i * 86_400_000);
      const p = generateChain(date);
      expect(p).toEqual(generateChain(date));
      expect(p.numbers).toHaveLength(CHAIN_SIZE);
      expect(p.best).toBeGreaterThanOrEqual(CHAIN_MIN);
      expect(verifyChain(p), date).toMatchObject({ valid: true });
    }
  });

  it('rejects a wrong best', () => {
    const p = generateChain('2026-09-01');
    expect(verifyChain({ ...p, best: p.best + 1 }).valid).toBe(false);
  });

  it('shares as text', () => {
    expect(chainShareText('2026-10-17', 6, 7)).toBe('Kette Nº 47 · 6/7');
  });
});
