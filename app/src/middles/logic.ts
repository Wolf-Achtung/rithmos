/**
 * The daily puzzle without the board: what a tap means, what a day is worth, what the
 * share text says. Pure functions, no React, no I/O.
 */
import { HARMONY_KINDS, harmonyKinds, meanOf } from '../../../engine/harmony';
import type { HarmonyKind } from '../../../engine/harmony';
import { middlesNumber } from '../../../jobs/src/middles';
import type { Triad } from '../../../jobs/src/middles';

export const MAX_TRIES = 3;

export type Feedback =
  | { readonly kind: 'right' }
  /** the tap was another mean of a and c: the player had that harmony in mind */
  | { readonly kind: 'otherMean'; readonly mean: HarmonyKind }
  | { readonly kind: 'wrong' };

/** What an offer says about the player's thinking. Truth from the engine, never guessed. */
export function feedbackFor(triad: Pick<Triad, 'kind' | 'a' | 'c'>, answer: number): Feedback {
  if (harmonyKinds(triad.a, answer, triad.c).includes(triad.kind)) return { kind: 'right' };
  for (const kind of HARMONY_KINDS) {
    if (kind !== triad.kind && meanOf(kind, triad.a, triad.c) === answer) return { kind: 'otherMean', mean: kind };
  }
  return { kind: 'wrong' };
}

/** One day, as stored on the device. */
export interface DayResult {
  readonly date: string;
  readonly solved: boolean;
  /** offers tapped or tones released, in order; length 1..MAX_TRIES */
  readonly answers: readonly number[];
  /** deviation of the last released tone from the mean, in cents; absent when tapped */
  readonly cents?: number;
}

export function triesOf(result: Pick<DayResult, 'answers'>): number {
  return result.answers.length;
}

/** Days in a row solved, counted back from the given day; a day not yet played does not break it. */
export function streakOn(results: readonly DayResult[], today: string): number {
  const byDate = new Map(results.map((r) => [r.date, r]));
  let day = today;
  let count = 0;
  if (!byDate.has(day)) day = previousDay(day);
  while (byDate.get(day)?.solved) {
    count++;
    day = previousDay(day);
  }
  return count;
}

export function previousDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** The address every shared result carries: the one way the game spreads. */
export const SITE = 'rithmos.de';

/** `Rithmos Nº 47 · 2/3`, the three boxes (one per try used) and the address. No emoji. */
export function shareText(date: string, result: Pick<DayResult, 'solved' | 'answers'>): string {
  const tries = triesOf(result);
  const score = result.solved ? `${tries}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  const boxes = Array.from({ length: MAX_TRIES }, (_, i) => (i < tries ? '■' : '□')).join('');
  return `Rithmos Nº ${middlesNumber(date)} · ${score}\n${boxes}\n${SITE}`;
}

/** Update the day's stored results with one more answer. */
export function recordAnswer(results: readonly DayResult[], date: string, answer: number, solved: boolean, cents?: number): DayResult[] {
  const rest = results.filter((r) => r.date !== date);
  const current = results.find((r) => r.date === date);
  const answers = [...(current?.answers ?? []), answer];
  const next: DayResult = cents === undefined ? { date, solved, answers } : { date, solved, answers, cents };
  return [...rest, next].sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** The day is over when it is solved or the tries are spent. */
export function isFinished(result: Pick<DayResult, 'solved' | 'answers'> | undefined): boolean {
  return !!result && (result.solved || result.answers.length >= MAX_TRIES);
}

/** Offers appear only for the try after this many misses (CLAUDE.md 2: input demands thinking). */
export const HELP_AFTER = 2;

/** Small triples of each kind that serve as the pattern in the question, never the answer. */
const EXAMPLES: Record<HarmonyKind, readonly (readonly [number, number, number])[]> = {
  arithmetic: [
    [2, 4, 6],
    [3, 5, 7],
    [1, 3, 5],
  ],
  geometric: [
    [2, 4, 8],
    [3, 6, 12],
    [1, 2, 4],
  ],
  musical: [
    [3, 4, 6],
    [2, 3, 6],
    [4, 6, 12],
  ],
};

/** An example of the same pattern that shares neither outer number with the puzzle. */
export function patternExample(kind: HarmonyKind, a: number, c: number): readonly [number, number, number] {
  return EXAMPLES[kind].find(([x, , z]) => x !== a && z !== c) ?? EXAMPLES[kind][0]!;
}

function gcd(x: number, y: number): number {
  return y === 0 ? x : gcd(y, x % y);
}

function ratio(x: number, y: number): string {
  const g = gcd(x, y) || 1;
  return `${x / g} : ${y / g}`;
}

function factor(q: number): string {
  const rounded = Math.round(q * 10) / 10;
  return `×${(Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace('.', ',')}`;
}

export interface GapLine {
  /** what the tip built on the left and on the right of the middle */
  readonly left: string;
  readonly right: string;
  /** the two halves agree: the pattern holds */
  readonly match: boolean;
}

/**
 * What a middle x builds between a and c, read in the pattern of the kind:
 * the two steps, the two factors, or the steps against the outer numbers.
 * This line is the feedback that teaches the rule (CLAUDE.md 2).
 */
export function gapLine(kind: HarmonyKind, a: number, x: number, c: number): GapLine {
  const match = harmonyKinds(a, x, c).includes(kind);
  if (kind === 'arithmetic') return { left: signed(x - a), right: signed(c - x), match };
  if (kind === 'geometric') return { left: factor(x / a), right: factor(c / x), match };
  const d1 = x - a;
  const d2 = c - x;
  const steps = Number.isInteger(d1) && Number.isInteger(d2) && d1 > 0 && d2 > 0 ? ratio(d1, d2) : `${signed(d1)} : ${signed(d2)}`;
  return { left: `Schritte ${steps}`, right: `außen ${ratio(a, c)}`, match };
}

function signed(d: number): string {
  const v = Math.round(d * 10) / 10;
  const s = (Number.isInteger(v) ? String(Math.abs(v)) : Math.abs(v).toFixed(1)).replace('.', ',');
  return v < 0 ? `−${s}` : `+${s}`;
}
