import { describe, expect, it } from 'vitest';
import { harmonyKindsOfFour } from '../../engine/harmony';
import { choosePracticeLevel, fourCandidates, generatePractice, practiceKind, practiceSeed, unlockedLevel, verifyPractice } from './practice';
import type { PracticeLevel } from './practice';

describe('practice generator', () => {
  it('four-number candidates carry the harmonic and the arithmetic mean', () => {
    const cs = fourCandidates();
    expect(cs.length).toBeGreaterThan(10);
    expect(cs).toContainEqual({ a: 6, hm: 8, am: 9, d: 12 });
    for (const { a, hm, am, d } of cs) {
      expect(harmonyKindsOfFour([a, hm, am, d])).toEqual(expect.arrayContaining(['arithmetic', 'musical']));
      expect(d).toBeLessThanOrEqual(4 * a);
    }
  });

  it('every level yields valid, deterministic puzzles across a hundred seeds', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const forms = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const p = generatePractice(level, practiceSeed(i));
        expect(p, `level ${level} seed ${i}`).toEqual(generatePractice(level, practiceSeed(i)));
        expect(verifyPractice(p), `level ${level} seed ${i}`).toMatchObject({ valid: true });
        expect(p.level).toBe(level);
        forms.add(p.form);
        if (level <= 3) expect(practiceKind(p)).toBe(['arithmetic', 'geometric', 'musical'][level - 1]);
      }
      expect(forms.size).toBe(1);
    }
    const kinds = new Set(Array.from({ length: 60 }, (_, i) => practiceKind(generatePractice(4, practiceSeed(i)))));
    expect([...kinds].sort()).toEqual(['arithmetic', 'geometric', 'musical']);
  });

  it('level 5 offers six distinct numbers including both answers', () => {
    const p = generatePractice(5, practiceSeed(3));
    if (p.form !== 'four') throw new Error('expected four');
    expect(p.options).toHaveLength(6);
    expect(new Set(p.options).size).toBe(6);
    expect(p.options).toContain(p.answers[0]);
    expect(p.options).toContain(p.answers[1]);
  });

  it('rejects tampered puzzles', () => {
    const t = generatePractice(1, practiceSeed(0));
    if (t.form !== 'triad') throw new Error('expected triad');
    expect(verifyPractice({ ...t, b: t.b + 1 }).valid).toBe(false);
    const w = generatePractice(4, practiceSeed(0));
    if (w.form !== 'which') throw new Error('expected which');
    expect(verifyPractice({ ...w, kind: w.kind === 'arithmetic' ? 'geometric' : 'arithmetic' }).valid).toBe(false);
    const f = generatePractice(5, practiceSeed(0));
    if (f.form !== 'four') throw new Error('expected four');
    expect(verifyPractice({ ...f, answers: [f.answers[1], f.answers[0]] }).valid).toBe(false);
  });

  it('levels open one after another and the lagging mean is pulled forward every third puzzle', () => {
    const solved: Record<number, number> = { 1: 5, 2: 5, 3: 2 };
    expect(unlockedLevel((l) => solved[l] ?? 0)).toBe(3);
    expect(unlockedLevel(() => 0)).toBe(1);
    expect(unlockedLevel(() => 99)).toBe(5);
    const unlocked: PracticeLevel = 3;
    expect(choosePracticeLevel(unlocked, 'arithmetic', 0)).toBe(3);
    expect(choosePracticeLevel(unlocked, 'arithmetic', 2)).toBe(1);
    expect(choosePracticeLevel(unlocked, 'musical', 2)).toBe(3);
    expect(choosePracticeLevel(2, 'musical', 2)).toBe(2); // musical is not open yet
    expect(choosePracticeLevel(unlocked, null, 2)).toBe(3);
  });
});
