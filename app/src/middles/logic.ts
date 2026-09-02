/**
 * Middles without the board: what a tap means, what a day is worth, what the
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
  /** offers tapped, in order; length 1..MAX_TRIES */
  readonly answers: readonly number[];
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

/** `Middles Nº 47 · 2/3` and the three boxes: one per try used. No emoji. */
export function shareText(date: string, result: Pick<DayResult, 'solved' | 'answers'>): string {
  const tries = triesOf(result);
  const score = result.solved ? `${tries}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  const boxes = Array.from({ length: MAX_TRIES }, (_, i) => (i < tries ? '■' : '□')).join('');
  return `Middles Nº ${middlesNumber(date)} · ${score}\n${boxes}`;
}

/** Update the day's stored results with one more answer. */
export function recordAnswer(results: readonly DayResult[], date: string, answer: number, solved: boolean): DayResult[] {
  const rest = results.filter((r) => r.date !== date);
  const current = results.find((r) => r.date === date);
  const answers = [...(current?.answers ?? []), answer];
  return [...rest, { date, solved, answers }].sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** The day is over when it is solved or the tries are spent. */
export function isFinished(result: Pick<DayResult, 'solved' | 'answers'> | undefined): boolean {
  return !!result && (result.solved || result.answers.length >= MAX_TRIES);
}
