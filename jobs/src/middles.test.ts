import { describe, expect, it } from 'vitest';
import { generateMiddles, harmonicTriples, isoDate, seedForDate, verifyMiddles } from './middles';

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
      expect([1, 2, 3]).toContain(p.difficulty);
      expect(p.pieces.filter((x) => x.side === p.side).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('rejects a tampered puzzle', () => {
    const p = generateMiddles('2026-09-01');
    const wrong = { ...p, solution: { ...p.solution, to: p.solution.from } };
    expect(verifyMiddles(wrong).valid).toBe(false);
  });

  it('formats dates in UTC', () => {
    expect(isoDate(Date.UTC(2026, 8, 1, 23, 59))).toBe('2026-09-01');
  });
});
