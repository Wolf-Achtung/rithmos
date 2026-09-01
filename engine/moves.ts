/**
 * Move generation and validation.
 *
 * THE COUNTING TRAP: Mebben counts start and target square. "Into the second
 * field" therefore means ONE step, "into the third field" two steps, "into the
 * fourth field" three steps. The step counts live in rules/mebben.ts; this file
 * walks exactly `steps` squares and not one more.
 */
import { inBounds, pieceAt, piecesOf, replacePiece, requirePiece, sameSquare } from './board';
import type { DirectionClass, PlacedPiece, PieceId, Position, Side, SimpleShape, Square } from './types';

export interface Move {
  readonly pieceId: PieceId;
  readonly from: Square;
  readonly to: Square;
  /** Which component shape a pyramid moved as. Absent for simple pieces. */
  readonly as?: SimpleShape;
}

export interface Direction {
  readonly df: number;
  readonly dr: number;
}

export const ORTHOGONAL: readonly Direction[] = [
  { df: 1, dr: 0 },
  { df: -1, dr: 0 },
  { df: 0, dr: 1 },
  { df: 0, dr: -1 },
];

export const DIAGONAL: readonly Direction[] = [
  { df: 1, dr: 1 },
  { df: 1, dr: -1 },
  { df: -1, dr: 1 },
  { df: -1, dr: -1 },
];

export function directionsFor(cls: DirectionClass): readonly Direction[] {
  switch (cls) {
    case 'orthogonal':
      return ORTHOGONAL;
    case 'diagonal':
      return DIAGONAL;
    case 'all':
      return [...ORTHOGONAL, ...DIAGONAL];
  }
}

/** The simple shapes a piece may move as: itself, or each live component shape of a pyramid. */
export function movementShapes(piece: PlacedPiece): SimpleShape[] {
  if (piece.shape !== 'pyramid') return [piece.shape];
  const shapes = new Set<SimpleShape>();
  for (const c of piece.components ?? []) shapes.add(c.shape);
  return [...shapes];
}

/** The regular movement directions of a piece (union over its shapes). */
export function regularDirections(pos: Position, piece: PlacedPiece): Direction[] {
  const out: Direction[] = [];
  const seen = new Set<string>();
  for (const shape of movementShapes(piece)) {
    for (const d of directionsFor(pos.rules.movement[shape].directions)) {
      const key = `${d.df},${d.dr}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(d);
      }
    }
  }
  return out;
}

export interface Reach {
  readonly square: Square;
  readonly as: SimpleShape;
}

export interface ReachOptions {
  /**
   * Allow the final square to hold an enemy piece. Used for capture threats
   * ("could move onto that piece next move"). Own pieces never count.
   */
  readonly allowEnemyTarget?: boolean;
}

/**
 * All squares the piece could travel to by a regular move from its current
 * square. Intermediate squares must be empty when the rule set forbids jumping.
 */
export function reachableSquares(pos: Position, piece: PlacedPiece, opts: ReachOptions = {}): Reach[] {
  const out: Reach[] = [];
  const seen = new Set<number>();
  for (const shape of movementShapes(piece)) {
    const rule = pos.rules.movement[shape];
    for (const d of directionsFor(rule.directions)) {
      let sq: Square = piece.square;
      let blocked = false;
      for (let step = 1; step <= rule.steps; step++) {
        sq = { file: sq.file + d.df, rank: sq.rank + d.dr };
        if (!inBounds(pos.rules, sq)) {
          blocked = true;
          break;
        }
        const occupant = pieceAt(pos, sq);
        if (step < rule.steps) {
          if (occupant && pos.rules.pathMustBeClear) {
            blocked = true;
            break;
          }
        } else if (occupant && !(opts.allowEnemyTarget && occupant.side !== piece.side)) {
          blocked = true;
        }
      }
      if (blocked) continue;
      const key = sq.rank * pos.rules.board.files + sq.file;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ square: sq, as: shape });
      }
    }
  }
  return out;
}

/** The shape the piece would use to reach `target`, or null when it cannot. */
export function canReach(pos: Position, piece: PlacedPiece, target: Square, opts: ReachOptions = {}): SimpleShape | null {
  for (const r of reachableSquares(pos, piece, opts)) {
    if (sameSquare(r.square, target)) return r.as;
  }
  return null;
}

export function legalMovesOf(pos: Position, piece: PlacedPiece): Move[] {
  return reachableSquares(pos, piece).map((r) => ({
    pieceId: piece.id,
    from: piece.square,
    to: r.square,
    ...(piece.shape === 'pyramid' ? { as: r.as } : {}),
  }));
}

export function legalMoves(pos: Position, side: Side = pos.sideToMove): Move[] {
  const out: Move[] = [];
  for (const piece of piecesOf(pos, side)) out.push(...legalMovesOf(pos, piece));
  return out;
}

export function isLegalMove(pos: Position, move: Move, side: Side = pos.sideToMove): boolean {
  const piece = pos.pieces.find((p) => p.id === move.pieceId);
  if (!piece || piece.side !== side || !sameSquare(piece.square, move.from)) return false;
  const as = canReach(pos, piece, move.to);
  if (!as) return false;
  return move.as === undefined || move.as === as;
}

/** Apply a regular move. Does not validate and does not change the side to move. */
export function applyMove(pos: Position, move: Move): Position {
  const piece = requirePiece(pos, move.pieceId);
  return replacePiece(pos, move.pieceId, { ...piece, square: move.to });
}

export function moveToString(move: Move): string {
  const f = (s: Square) => `${'abcdefgh'[s.file]}${s.rank + 1}`;
  return `${move.pieceId} ${f(move.from)}-${f(move.to)}${move.as ? ` as ${move.as}` : ''}`;
}
