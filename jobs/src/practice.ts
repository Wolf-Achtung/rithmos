/**
 * Practice (CLAUDE.md, Stufe 2): the progression beside the daily puzzle.
 * Five levels — arithmetic, geometric, musical, "which mean?", four numbers
 * with two means. Generated on the device from a seed, verified by the same
 * recognition the daily uses; no server involved.
 */
import { HARMONY_KINDS, harmonyKinds, harmonyKindsOfFour, meanOf } from '../../engine/harmony';
import type { HarmonyKind } from '../../engine/harmony';
import { TRIAD_MAX_RATIO, mulberry32, seedForDate, triadCandidates, triadOptions } from './middles';
import type { Triad } from './middles';

export type PracticeLevel = 1 | 2 | 3 | 4 | 5;
export const PRACTICE_LEVELS: readonly PracticeLevel[] = [1, 2, 3, 4, 5];

/** Levels 1..3 train one mean each. */
export const LEVEL_KIND: Record<1 | 2 | 3, HarmonyKind> = { 1: 'arithmetic', 2: 'geometric', 3: 'musical' };
export const KIND_LEVEL: Record<HarmonyKind, 1 | 2 | 3> = { arithmetic: 1, geometric: 2, musical: 3 };

/** Solved puzzles at a level before the next one opens. */
export const UNLOCK_AFTER = 5;

export type PracticePuzzle =
  /** levels 1..3: the daily form, one mean named */
  | { readonly level: 1 | 2 | 3; readonly form: 'triad'; readonly triad: Triad; readonly b: number }
  /** level 4: three numbers stand, which mean is it? */
  | { readonly level: 4; readonly form: 'which'; readonly values: readonly [number, number, number]; readonly kind: HarmonyKind }
  /** level 5: a and d stand, the harmonic and the arithmetic mean are missing */
  | { readonly level: 5; readonly form: 'four'; readonly a: number; readonly d: number; readonly answers: readonly [number, number]; readonly options: readonly number[] };

/** The kind of a practice puzzle for the hit rate: level 5 counts as musical, its harder half. */
export function practiceKind(p: PracticePuzzle): HarmonyKind {
  if (p.form === 'triad') return p.triad.kind;
  if (p.form === 'which') return p.kind;
  return 'musical';
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** All a < d with whole harmonic and arithmetic means, d at most four times a. */
export function fourCandidates(maxD = 60): { a: number; hm: number; am: number; d: number }[] {
  const out: { a: number; hm: number; am: number; d: number }[] = [];
  for (let a = 2; a <= maxD; a++)
    for (let d = a + 3; d <= Math.min(maxD, a * TRIAD_MAX_RATIO); d++) {
      const hm = meanOf('musical', a, d);
      const am = meanOf('arithmetic', a, d);
      if (hm !== null && am !== null && hm < am) out.push({ a, hm, am, d });
    }
  return out;
}

function fourOptions(a: number, hm: number, am: number, d: number, rnd: () => number): number[] {
  const used = new Set<number>([a, hm, am, d]);
  const options = [hm, am];
  const gm = meanOf('geometric', a, d);
  if (gm !== null && !used.has(gm)) {
    options.push(gm);
    used.add(gm);
  }
  const between: number[] = [];
  for (let v = a + 1; v < d; v++) if (!used.has(v)) between.push(v);
  const fillers = shuffle(between, rnd);
  for (let v = 1; options.length + fillers.length < 6; v++) if (!used.has(d + v)) fillers.push(d + v);
  while (options.length < 6) options.push(fillers.shift()!);
  return shuffle(options, rnd);
}

/** Deterministic: the same level and seed always give the same puzzle. */
export function generatePractice(level: PracticeLevel, seed: number): PracticePuzzle {
  const rnd = mulberry32((seed ^ (level * 0x9e3779b9)) >>> 0);
  if (level === 1 || level === 2 || level === 3) {
    const kind = LEVEL_KIND[level];
    const cs = triadCandidates(kind);
    const { a, b, c } = cs[Math.floor(rnd() * cs.length)]!;
    return { level, form: 'triad', triad: { kind, a, c, options: triadOptions(kind, a, b, c, rnd) }, b };
  }
  if (level === 4) {
    const kind = HARMONY_KINDS[Math.floor(rnd() * HARMONY_KINDS.length)]!;
    const cs = triadCandidates(kind);
    const { a, b, c } = cs[Math.floor(rnd() * cs.length)]!;
    return { level: 4, form: 'which', values: [a, b, c], kind };
  }
  const cs = fourCandidates();
  const { a, hm, am, d } = cs[Math.floor(rnd() * cs.length)]!;
  return { level: 5, form: 'four', a, d, answers: [hm, am], options: fourOptions(a, hm, am, d, rnd) };
}

/** Seed for the n-th practice puzzle of a player. */
export function practiceSeed(count: number): number {
  return seedForDate(`practice:${count}`);
}

/** Re-check a practice puzzle by recognition. */
export function verifyPractice(p: PracticePuzzle): { valid: boolean; reason: string } {
  if (p.form === 'triad') {
    const { a, c, kind, options } = p.triad;
    if (harmonyKinds(a, p.b, c).join() !== kind) return { valid: false, reason: 'not the stated harmony' };
    if (options.length !== 4 || new Set(options).size !== 4 || !options.includes(p.b)) return { valid: false, reason: 'offers' };
    if (options.some((v) => v !== p.b && harmonyKinds(a, v, c).includes(kind))) return { valid: false, reason: 'a second offer closes the harmony' };
    return { valid: true, reason: 'ok' };
  }
  if (p.form === 'which') {
    const kinds = harmonyKinds(...p.values);
    return kinds.length === 1 && kinds[0] === p.kind ? { valid: true, reason: 'ok' } : { valid: false, reason: `kinds ${kinds.join()}` };
  }
  const [hm, am] = p.answers;
  const four = [p.a, hm, am, p.d];
  if (!(p.a < hm && hm < am && am < p.d)) return { valid: false, reason: 'not ascending' };
  if (meanOf('musical', p.a, p.d) !== hm || meanOf('arithmetic', p.a, p.d) !== am) return { valid: false, reason: 'answers are not the means' };
  const kinds = harmonyKindsOfFour(four);
  if (!kinds.includes('arithmetic') || !kinds.includes('musical')) return { valid: false, reason: 'four numbers lack the two means' };
  if (p.options.length !== 6 || new Set(p.options).size !== 6 || !p.options.includes(hm) || !p.options.includes(am)) return { valid: false, reason: 'offers' };
  return { valid: true, reason: 'ok' };
}

/**
 * Which level to play next. Levels open one after another; among the open
 * ones the lagging mean is pulled forward every third puzzle, otherwise the
 * highest open level is played.
 */
export function choosePracticeLevel(unlocked: PracticeLevel, weakest: HarmonyKind | null, count: number): PracticeLevel {
  if (weakest !== null && count % 3 === 2) {
    const level = KIND_LEVEL[weakest];
    if (level <= unlocked) return level;
  }
  return unlocked;
}

/** The highest level open to a player, from solved counts per level. */
export function unlockedLevel(solvedAt: (level: PracticeLevel) => number): PracticeLevel {
  let level: PracticeLevel = 1;
  while (level < 5 && solvedAt(level) >= UNLOCK_AFTER) level = (level + 1) as PracticeLevel;
  return level;
}
