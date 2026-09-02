/**
 * Board, pieces, values. Construction of positions and cheap lookups.
 */
import { mebben } from './rules/mebben';
import type {
  Piece,
  PieceId,
  PlacedPiece,
  Position,
  PyramidComponent,
  RuleSet,
  Shape,
  Side,
  Square,
} from './types';

export const FILE_LETTERS = 'abcdefgh';

export function opponent(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

export function squareIndex(rules: RuleSet, sq: Square): number {
  return sq.rank * rules.board.files + sq.file;
}

export function inBounds(rules: RuleSet, sq: Square): boolean {
  return sq.file >= 0 && sq.file < rules.board.files && sq.rank >= 0 && sq.rank < rules.board.ranks;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank;
}

/** "c4" style name: files a..h, ranks 1..16. */
export function squareName(sq: Square): string {
  return `${FILE_LETTERS[sq.file] ?? '?'}${sq.rank + 1}`;
}

export function parseSquare(name: string): Square {
  const m = /^([a-h])(\d{1,2})$/.exec(name.trim().toLowerCase());
  if (!m) throw new Error(`invalid square name: ${name}`);
  return { file: FILE_LETTERS.indexOf(m[1]!), rank: Number(m[2]) - 1 };
}

/** Own half: white ranks 0..7, black ranks 8..15. The enemy half is the other one. */
export function isEnemyHalf(rules: RuleSet, side: Side, sq: Square): boolean {
  const half = rules.board.ranks / 2;
  return side === 'white' ? sq.rank >= half : sq.rank < half;
}

export function pieceAt(pos: Position, sq: Square): PlacedPiece | null {
  if (!inBounds(pos.rules, sq)) return null;
  return pos.grid[squareIndex(pos.rules, sq)] ?? null;
}

export function pieceById(pos: Position, id: PieceId): PlacedPiece | undefined {
  return pos.pieces.find((p) => p.id === id);
}

export function requirePiece(pos: Position, id: PieceId): PlacedPiece {
  const p = pieceById(pos, id);
  if (!p) throw new Error(`no such piece: ${id}`);
  return p;
}

export function piecesOf(pos: Position, side: Side): PlacedPiece[] {
  return pos.pieces.filter((p) => p.side === side);
}

export function pyramidValue(components: readonly PyramidComponent[]): number {
  return components.reduce((sum, c) => sum + c.value, 0);
}

function buildGrid(rules: RuleSet, pieces: readonly PlacedPiece[]): (PlacedPiece | null)[] {
  const grid: (PlacedPiece | null)[] = new Array(rules.board.files * rules.board.ranks).fill(null);
  for (const p of pieces) {
    if (!inBounds(rules, p.square)) throw new Error(`piece ${p.id} off board at ${squareName(p.square)}`);
    const idx = squareIndex(rules, p.square);
    if (grid[idx]) throw new Error(`two pieces on ${squareName(p.square)}: ${grid[idx]!.id} and ${p.id}`);
    grid[idx] = p;
  }
  return grid;
}

/** Build a position from placed pieces. Validates bounds, overlaps and id uniqueness. */
export function makePosition(pieces: readonly PlacedPiece[], sideToMove: Side, rules: RuleSet = mebben): Position {
  const ids = new Set<PieceId>();
  for (const p of pieces) {
    if (ids.has(p.id)) throw new Error(`duplicate piece id: ${p.id}`);
    ids.add(p.id);
  }
  return { rules, pieces: [...pieces], grid: buildGrid(rules, pieces), sideToMove };
}

/** Return a position with `pieces` replaced by the given list (same rules). */
export function withPieces(pos: Position, pieces: readonly PlacedPiece[], sideToMove: Side = pos.sideToMove): Position {
  return makePosition(pieces, sideToMove, pos.rules);
}

/** Replace one piece (by id) with a new version, or remove it when `next` is null. */
export function replacePiece(pos: Position, id: PieceId, next: PlacedPiece | null): Position {
  const pieces = next ? pos.pieces.map((p) => (p.id === id ? next : p)) : pos.pieces.filter((p) => p.id !== id);
  return withPieces(pos, pieces);
}

const SHAPE_LETTER: Record<Shape, string> = { round: 'r', triangle: 't', square: 's', pyramid: 'p' };

/** Stable, readable id: side letter, shape letter, value; a suffix separates equal values. */
export function makeId(side: Side, shape: Shape, value: number, taken: Set<PieceId>): PieceId {
  const base = `${side === 'white' ? 'W' : 'B'}${SHAPE_LETTER[shape]}${value}`;
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  taken.add(id);
  return id;
}

/** Spec for building test positions by hand. */
export interface PieceInput {
  id?: PieceId;
  side: Side;
  shape: Shape;
  /** Required for simple pieces; for a pyramid derived from `components` when omitted. */
  value?: number;
  components?: readonly PyramidComponent[];
  /** Either `square` or `at` (a name like "c4"). */
  square?: Square;
  at?: string;
}

export function place(inputs: readonly PieceInput[], sideToMove: Side = 'white', rules: RuleSet = mebben): Position {
  const taken = new Set<PieceId>();
  for (const i of inputs) if (i.id) taken.add(i.id);
  const pieces: PlacedPiece[] = inputs.map((i) => {
    const square = i.square ?? (i.at ? parseSquare(i.at) : undefined);
    if (!square) throw new Error('piece needs square or at');
    if (i.shape === 'pyramid') {
      if (!i.components) throw new Error('pyramid needs components');
      const value = pyramidValue(i.components);
      const id = i.id ?? makeId(i.side, 'pyramid', value, taken);
      return { id, side: i.side, shape: 'pyramid', value, components: [...i.components], square };
    }
    if (i.value === undefined) throw new Error('piece needs value');
    const id = i.id ?? makeId(i.side, i.shape, i.value, taken);
    return { id, side: i.side, shape: i.shape, value: i.value, square };
  });
  return makePosition(pieces, sideToMove, rules);
}

/** The starting position of a rule set. White moves first. */
export function initialPosition(rules: RuleSet = mebben): Position {
  const taken = new Set<PieceId>();
  const pieces: PlacedPiece[] = [];
  const sides: Side[] = ['white', 'black'];
  for (const side of sides) {
    const setup = rules.setup[side];
    const toRank = (r: number) => (side === 'white' ? r : rules.board.ranks - 1 - r);
    for (const spec of setup.pieces) {
      pieces.push({
        id: makeId(side, spec.shape, spec.value, taken),
        side,
        shape: spec.shape,
        value: spec.value,
        square: { file: spec.file, rank: toRank(spec.rank) },
      });
    }
    if (!setup.pyramid) continue;
    const value = pyramidValue(setup.pyramid.components);
    pieces.push({
      id: makeId(side, 'pyramid', value, taken),
      side,
      shape: 'pyramid',
      value,
      components: [...setup.pyramid.components],
      square: { file: setup.pyramid.file, rank: toRank(setup.pyramid.rank) },
    });
  }
  return makePosition(pieces, 'white', rules);
}

export function describePiece(p: Piece): string {
  return `${p.side} ${p.shape} ${p.value} (${p.id})`;
}
