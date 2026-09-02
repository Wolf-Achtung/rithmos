/**
 * "Stimmen": the missing number is found by ear. The slider runs over the
 * pitch between a and c; where the player lets go decides. Pure functions,
 * no audio here.
 */
import type { HarmonyKind } from '../../../engine/harmony';
import { HARMONY_KINDS, meanOf } from '../../../engine/harmony';

/** How far off a release may be and still count, in cents (100 = a semitone). */
export const LOCK_CENTS = 25;

/** The visible snap while dragging, in cents. */
export const SNAP_CENTS = 12;

/** Cents between two values read as frequencies. */
export function centsBetween(value: number, target: number): number {
  return 1200 * Math.log2(value / target);
}

/** Slider position 0..1 to a value between a and c, evenly in pitch. */
export function valueAt(position: number, a: number, c: number): number {
  const p = Math.min(1, Math.max(0, position));
  return a * Math.pow(c / a, p);
}

/** The inverse: where a value sits on the slider. */
export function positionOf(value: number, a: number, c: number): number {
  return Math.log(value / a) / Math.log(c / a);
}

export interface Snap {
  readonly kind: HarmonyKind;
  readonly value: number;
  readonly cents: number;
}

/** The nearest whole-number mean within the snap width, if any. */
export function snapNear(value: number, a: number, c: number, width = SNAP_CENTS): Snap | null {
  let best: Snap | null = null;
  for (const kind of HARMONY_KINDS) {
    const m = meanOf(kind, a, c);
    if (m === null) continue;
    const cents = centsBetween(value, m);
    if (Math.abs(cents) <= width && (best === null || Math.abs(cents) < Math.abs(best.cents))) best = { kind, value: m, cents };
  }
  return best;
}

export type Release =
  | { readonly kind: 'right'; readonly cents: number }
  | { readonly kind: 'otherMean'; readonly mean: HarmonyKind; readonly value: number; readonly cents: number }
  | { readonly kind: 'off'; readonly cents: number; readonly nearest: number };

/** What letting go at a value means for the puzzle. */
export function judgeRelease(value: number, target: number, kind: HarmonyKind, a: number, c: number): Release {
  const cents = centsBetween(value, target);
  if (Math.abs(cents) <= LOCK_CENTS) return { kind: 'right', cents };
  for (const other of HARMONY_KINDS) {
    if (other === kind) continue;
    const m = meanOf(other, a, c);
    if (m !== null && Math.abs(centsBetween(value, m)) <= LOCK_CENTS) return { kind: 'otherMean', mean: other, value: m, cents };
  }
  return { kind: 'off', cents, nearest: Math.round(value) };
}

/** How far off a length may be and still count, as a share of the target (6 %). */
export const LENGTH_TOLERANCE = 0.06;

export type LengthRelease =
  | { readonly kind: 'right'; readonly off: number }
  | { readonly kind: 'otherMean'; readonly mean: HarmonyKind; readonly value: number; readonly off: number }
  | { readonly kind: 'off'; readonly off: number; readonly nearest: number };

/** What letting go of the middle bar at a length means; `off` is the relative deviation from the target. */
export function judgeLength(value: number, target: number, kind: HarmonyKind, a: number, c: number, tolerance = LENGTH_TOLERANCE): LengthRelease {
  const off = (value - target) / target;
  if (Math.abs(off) <= tolerance) return { kind: 'right', off };
  for (const other of HARMONY_KINDS) {
    if (other === kind) continue;
    const m = meanOf(other, a, c);
    if (m !== null && Math.abs((value - m) / m) <= tolerance) return { kind: 'otherMean', mean: other, value: m, off };
  }
  return { kind: 'off', off, nearest: Math.round(value) };
}
