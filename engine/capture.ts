/**
 * The four ways of capturing (Mebben after Selenus 1616).
 *
 * A capturing piece stays where it is and never enters the target square.
 * Captures are enumerated against a position; when they are declared is a
 * rule datum (rules.captureTiming), handled by game.ts.
 */
import { opponent, piecesOf, replacePiece, requirePiece } from './board';
import { canReach, legalMoves, legalMovesOf, applyMove } from './moves';
import type { PieceId, PlacedPiece, Position, Side } from './types';

export type CaptureMethod = 'meeting' | 'ambush' | 'assault' | 'siege';

export interface MeetingDetail {
  readonly method: 'meeting';
  readonly value: number;
}

export interface AmbushDetail {
  readonly method: 'ambush';
  readonly values: readonly number[];
  readonly operation: 'sum' | 'difference';
  readonly result: number;
}

export interface AssaultDetail {
  readonly method: 'assault';
  readonly value: number;
  /** Empty squares between attacker and target. */
  readonly distance: number;
  readonly operation: 'times' | 'divided';
  readonly result: number;
}

export interface SiegeDetail {
  readonly method: 'siege';
}

export type CaptureDetail = MeetingDetail | AmbushDetail | AssaultDetail | SiegeDetail;

export interface Capture {
  readonly method: CaptureMethod;
  /** Capturing pieces: one for meeting, assault and siege; two or more for ambush. */
  readonly by: readonly PieceId[];
  readonly target: PieceId;
  /** Pyramid only: the component value taken, when not the whole pyramid. */
  readonly component?: number;
  readonly detail: CaptureDetail;
}

/** A value on which a piece can be taken: the piece itself, or one pyramid component. */
export interface TargetValue {
  readonly value: number;
  readonly component?: number;
}

export function targetValues(pos: Position, piece: PlacedPiece): TargetValue[] {
  const out: TargetValue[] = [{ value: piece.value }];
  if (piece.shape === 'pyramid' && pos.rules.pyramidComponentCapture) {
    const seen = new Set<number>([piece.value]);
    for (const c of piece.components ?? []) {
      if (!seen.has(c.value)) {
        seen.add(c.value);
        out.push({ value: c.value, component: c.value });
      }
    }
  }
  return out;
}

function withComponent(capture: Omit<Capture, 'component'>, tv: TargetValue): Capture {
  return tv.component === undefined ? capture : { ...capture, component: tv.component };
}

/**
 * Meeting: an own piece could, by its next regular move, land on the square of
 * an enemy piece of equal value.
 */
export function meetingCaptures(pos: Position, side: Side): Capture[] {
  const out: Capture[] = [];
  const enemies = piecesOf(pos, opponent(side));
  for (const a of piecesOf(pos, side)) {
    for (const b of enemies) {
      if (!canReach(pos, a, b.square, { allowEnemyTarget: true })) continue;
      for (const tv of targetValues(pos, b)) {
        if (tv.value === a.value) {
          out.push(withComponent({ method: 'meeting', by: [a.id], target: b.id, detail: { method: 'meeting', value: a.value } }, tv));
        }
      }
    }
  }
  return out;
}

/** All captures available to `side` in this position, every method. */
export function findCaptures(pos: Position, side: Side): Capture[] {
  return [...meetingCaptures(pos, side)];
}

/** Remove the captured piece, or the captured pyramid component. */
export function applyCapture(pos: Position, capture: Capture): Position {
  const target = requirePiece(pos, capture.target);
  if (capture.component === undefined || target.shape !== 'pyramid') {
    return replacePiece(pos, target.id, null);
  }
  const components = target.components ?? [];
  const idx = components.findIndex((c) => c.value === capture.component);
  if (idx < 0) throw new Error(`pyramid ${target.id} has no component ${capture.component}`);
  const rest = components.filter((_, i) => i !== idx);
  if (rest.length === 0) return replacePiece(pos, target.id, null);
  const value = rest.reduce((s, c) => s + c.value, 0);
  return replacePiece(pos, target.id, { ...target, components: rest, value });
}

export function captureToString(c: Capture): string {
  const comp = c.component === undefined ? '' : ` (component ${c.component})`;
  return `${c.method}: ${c.by.join('+')} takes ${c.target}${comp}`;
}

// re-exported for siblings that reason about mobility
export { legalMoves, legalMovesOf, applyMove };
