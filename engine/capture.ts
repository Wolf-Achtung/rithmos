/**
 * The four ways of capturing (Mebben after Selenus 1616).
 *
 * A capturing piece stays where it is and never enters the target square.
 * Captures are enumerated against a position; when they are declared is a
 * rule datum (rules.captureTiming), handled by game.ts.
 */
import { inBounds, opponent, pieceAt, piecesOf, replacePiece, requirePiece } from './board';
import { applyMove, canReach, directionsFor, legalMoves, legalMovesOf, movementShapes } from './moves';
import type { Move } from './moves';
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

/**
 * Pieces standing in the way of `piece`: the first occupant on each regular
 * path, within the reach of the piece. Includes pieces of both sides.
 */
export function blockingPieces(pos: Position, piece: PlacedPiece): PlacedPiece[] {
  const out: PlacedPiece[] = [];
  const seen = new Set<PieceId>();
  for (const shape of movementShapes(piece)) {
    const rule = pos.rules.movement[shape];
    for (const d of directionsFor(rule.directions)) {
      let sq = piece.square;
      for (let step = 1; step <= rule.steps; step++) {
        sq = { file: sq.file + d.df, rank: sq.rank + d.dr };
        if (!inBounds(pos.rules, sq)) break;
        const occupant = pieceAt(pos, sq);
        if (occupant) {
          if (!seen.has(occupant.id)) {
            seen.add(occupant.id);
            out.push(occupant);
          }
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Siege: the enemy piece can neither move nor be freed by a single move of
 * one of its own side's pieces. At least one of the blockers must belong to
 * the besieging side (board edges and the target's own pieces do not besiege
 * on their own).
 */
export function siegeCaptures(pos: Position, side: Side): Capture[] {
  const out: Capture[] = [];
  const enemySide = opponent(side);
  let friendlyMoves: Move[] | null = null;
  for (const b of piecesOf(pos, enemySide)) {
    if (legalMovesOf(pos, b).length > 0) continue;
    const besiegers = blockingPieces(pos, b).filter((p) => p.side === side);
    if (besiegers.length === 0) continue;
    friendlyMoves ??= legalMoves(pos, enemySide);
    let freeable = false;
    for (const m of friendlyMoves) {
      if (m.pieceId === b.id) continue;
      if (legalMovesOf(applyMove(pos, m), b).length > 0) {
        freeable = true;
        break;
      }
    }
    if (freeable) continue;
    out.push({ method: 'siege', by: besiegers.map((p) => p.id), target: b.id, detail: { method: 'siege' } });
  }
  return out;
}

/** All captures available to `side` in this position, every method. */
export function findCaptures(pos: Position, side: Side): Capture[] {
  return [...meetingCaptures(pos, side), ...siegeCaptures(pos, side)];
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
