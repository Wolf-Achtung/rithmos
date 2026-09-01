/**
 * The four ways of capturing (Mebben after Selenus 1616).
 *
 * A capturing piece stays where it is and never enters the target square.
 * Captures are enumerated against a position; when they are declared is a
 * rule datum (rules.captureTiming), handled by game.ts.
 */
import { inBounds, opponent, pieceAt, piecesOf, replacePiece, requirePiece } from './board';
import { applyMove, canReach, directionsFor, legalMoves, legalMovesOf, movementShapes, regularDirections } from './moves';
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

function subsetsOfSize<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]) => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

/** Largest group of ambushing pieces considered for a sum. */
const MAX_AMBUSH_GROUP = 4;

/**
 * Ambush: two or more own pieces could each, by their next regular move, land
 * on the square of an enemy piece, and their sum or difference equals its value.
 * The difference is taken for pairs; the sum for groups of two to four.
 */
export function ambushCaptures(pos: Position, side: Side): Capture[] {
  const out: Capture[] = [];
  const own = piecesOf(pos, side);
  for (const b of piecesOf(pos, opponent(side))) {
    const attackers = own.filter((a) => canReach(pos, a, b.square, { allowEnemyTarget: true }));
    if (attackers.length < 2) continue;
    const tvs = targetValues(pos, b);
    for (let size = 2; size <= Math.min(MAX_AMBUSH_GROUP, attackers.length); size++) {
      for (const group of subsetsOfSize(attackers, size)) {
        const values = group.map((a) => a.value);
        const by = group.map((a) => a.id);
        const sum = values.reduce((s, v) => s + v, 0);
        for (const tv of tvs) {
          if (tv.value === sum) {
            out.push(withComponent({ method: 'ambush', by, target: b.id, detail: { method: 'ambush', values, operation: 'sum', result: sum } }, tv));
          }
        }
        if (size === 2) {
          const diff = Math.abs(values[0]! - values[1]!);
          if (diff === 0) continue;
          for (const tv of tvs) {
            if (tv.value === diff) {
              out.push(withComponent({ method: 'ambush', by, target: b.id, detail: { method: 'ambush', values, operation: 'difference', result: diff } }, tv));
            }
          }
        }
      }
    }
  }
  return out;
}

/**
 * Assault: an own piece looks along one of its regular directions over
 * `distance` empty squares at an enemy piece, and its value times or divided
 * by that distance equals the enemy's value. The distance is not limited by the
 * move length. Zero empty squares between them is never an assault (that would
 * be a meeting), and a division must come out even.
 */
export function assaultCaptures(pos: Position, side: Side): Capture[] {
  const out: Capture[] = [];
  for (const a of piecesOf(pos, side)) {
    for (const d of regularDirections(pos, a)) {
      let sq = a.square;
      let distance = 0;
      for (;;) {
        sq = { file: sq.file + d.df, rank: sq.rank + d.dr };
        if (!inBounds(pos.rules, sq)) break;
        const occupant = pieceAt(pos, sq);
        if (!occupant) {
          distance++;
          continue;
        }
        if (occupant.side === side || distance === 0) break;
        for (const tv of targetValues(pos, occupant)) {
          if (a.value * distance === tv.value) {
            out.push(withComponent({ method: 'assault', by: [a.id], target: occupant.id, detail: { method: 'assault', value: a.value, distance, operation: 'times', result: a.value * distance } }, tv));
          } else if (a.value % distance === 0 && a.value / distance === tv.value) {
            out.push(withComponent({ method: 'assault', by: [a.id], target: occupant.id, detail: { method: 'assault', value: a.value, distance, operation: 'divided', result: a.value / distance } }, tv));
          }
        }
        break;
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
  return [
    ...meetingCaptures(pos, side),
    ...ambushCaptures(pos, side),
    ...assaultCaptures(pos, side),
    ...siegeCaptures(pos, side),
  ];
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
