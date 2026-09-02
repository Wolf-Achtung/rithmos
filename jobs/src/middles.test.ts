import { describe, expect, it } from 'vitest';
import { HARMONY_KINDS, harmonyKinds, meanOf } from '../../engine/harmony';
import { generateMiddles, generateTriad, harmonicTriples, isoDate, middlesNumber, mulberry32, seedForDate, triadCandidates, triadOptions, verifyMiddles } from './middles';

describe('Middles generator', () => {
  it('both sides have harmonic triples among their stones', () => {
    expect(harmonicTriples('white').length).toBeGreaterThan(5);
    expect(harmonicTriples('black').length).toBeGreaterThan(5);
  });

  it('is deterministic per date', () => {
    const a = generateMiddles('2026-09-01');
    const b = generateMiddles('2026-09-01');
    expect(a).toEqual(b);
    expect(generateMiddles('2026-09-02')).not.toEqual(a);
    expect(seedForDate('2026-09-01')).not.toBe(seedForDate('2026-09-02'));
  });

  it('every puzzle of a month verifies: unique solution, the middle stone moves', () => {
    for (let day = 1; day <= 30; day++) {
      const date = `2026-09-${String(day).padStart(2, '0')}`;
      const p = generateMiddles(date);
      expect(verifyMiddles(p), date).toMatchObject({ valid: true });
      expect(p.solution.pieceId).toBe('m');
      expect(p.harmony.values[1]).toBe(p.pieces.find((x) => x.id === 'm')!.value);
      expect(p.triad.options).toContain(p.solution.b);
      expect([1, 2, 3]).toContain(p.difficulty);
      expect(p.pieces.filter((x) => x.side === p.side).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('rejects a tampered puzzle', () => {
    const p = generateMiddles('2026-09-01');
    const wrong = { ...p, solution: { ...p.solution, to: p.solution.from } };
    expect(verifyMiddles(wrong).valid).toBe(false);
    const wrongTriad = { ...p, solution: { ...p.solution, b: p.solution.b + 1 } };
    expect(verifyMiddles(wrongTriad).reason).toBe('triad is not the stated harmony');
    const missing = { ...p, triad: { ...p.triad, options: p.triad.options.filter((v) => v !== p.solution.b).concat(p.triad.c + 99) } };
    expect(verifyMiddles(missing).reason).toBe('triad offers lack the answer');
  });

  it('counts days from the epoch: Nº 1 on 2026-09-01', () => {
    expect(middlesNumber('2026-09-01')).toBe(1);
    expect(middlesNumber('2026-09-02')).toBe(2);
    expect(middlesNumber('2026-10-17')).toBe(47);
  });
});

describe('the triad', () => {
  it('candidates of every kind are recognised as that kind', () => {
    for (const kind of HARMONY_KINDS) {
      const cs = triadCandidates(kind);
      expect(cs.length, kind).toBeGreaterThan(20);
      for (const { a, b, c } of cs) expect(harmonyKinds(a, b, c)).toEqual([kind]);
    }
    expect(triadCandidates('musical')).toContainEqual({ a: 6, b: 8, c: 12 });
  });

  it('offers contain the answer and the other whole-number means', () => {
    const options = triadOptions('musical', 6, 8, 12, mulberry32(1));
    expect(options).toHaveLength(4);
    expect(options).toContain(8);
    expect(options).toContain(9); // arithmetic: the tempting wrong answer
    expect(new Set(options).size).toBe(4);
    // 2 · ? · 8: all three means are whole numbers
    const all = triadOptions('arithmetic', 2, 5, 8, mulberry32(2));
    expect(all).toContain(5);
    expect(all).toContain(4); // geometric
    expect(meanOf('musical', 2, 8)).toBeNull(); // 3.2: no whole-number musical distractor here
  });

  it('fills from outside when there is no room between a and c', () => {
    const options = triadOptions('arithmetic', 2, 3, 4, mulberry32(3));
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(options.every((v) => v >= 1)).toBe(true);
  });

  it('a season of triads: deterministic, valid, all three kinds, small numbers', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 90; i++) {
      const date = isoDate(Date.parse('2026-09-01T00:00:00Z') + i * 86_400_000);
      const t = generateTriad(date);
      expect(t).toEqual(generateTriad(date));
      kinds.add(t.kind);
      expect(harmonyKinds(t.a, t.b, t.c)).toEqual([t.kind]);
      expect(t.options).toContain(t.b);
      expect(t.c).toBeLessThanOrEqual(64);
      for (const other of HARMONY_KINDS) {
        const m = meanOf(other, t.a, t.c);
        if (m !== null) expect(t.options, `${date} ${other} mean ${m}`).toContain(m);
      }
    }
    expect([...kinds].sort()).toEqual(['arithmetic', 'geometric', 'musical']);
  });

  it('formats dates in UTC', () => {
    expect(isoDate(Date.UTC(2026, 8, 1, 23, 59))).toBe('2026-09-01');
  });
});
