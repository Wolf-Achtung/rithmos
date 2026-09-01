/**
 * Middles: the daily puzzle. Two stones of a harmony already stand; the
 * player finds the square where the third stone, the middle, completes it
 * in one move. Every puzzle is verified with the solver: exactly one move
 * reaches the goal, and it is the intended one.
 *
 * Deterministic: the same date always yields the same puzzle.
 */
import { isEnemyHalf, place, squareName } from '../../engine/board';
import type { PieceInput } from '../../engine/board';
import { findHarmonies, harmonyKinds } from '../../engine/harmony';
import type { HarmonyKind } from '../../engine/harmony';
import { reachableSquares } from '../../engine/moves';
import { mebben } from '../../engine/rules/mebben';
import { solvePuzzle } from '../../engine/solver';
import type { PieceId, Side, SimpleShape, Square } from '../../engine/types';

export interface PuzzlePiece {
  readonly id: PieceId;
  readonly side: Side;
  readonly shape: SimpleShape;
  readonly value: number;
  readonly square: string;
}

export interface MiddlesPuzzle {
  readonly date: string;
  readonly seed: number;
  readonly side: Side;
  readonly pieces: readonly PuzzlePiece[];
  readonly goal: { readonly kind: 'harmony' };
  readonly solution: { readonly pieceId: PieceId; readonly from: string; readonly to: string };
  readonly harmony: { readonly kinds: readonly HarmonyKind[]; readonly values: readonly number[] };
  /** 1 easy .. 3 hard */
  readonly difficulty: 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Deterministic randomness.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed from an ISO date, stable across runs. */
export function seedForDate(date: string): number {
  let h = 2166136261;
  for (const ch of date) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Piece pools from the rule set.

interface PoolPiece {
  readonly shape: SimpleShape;
  readonly value: number;
}

function pool(side: Side): PoolPiece[] {
  return mebben.setup[side].pieces.map((p) => ({ shape: p.shape, value: p.value }));
}

/** All triples a < b < c from a side's values that form a harmony, with the shape of each. */
export function harmonicTriples(side: Side): { pieces: [PoolPiece, PoolPiece, PoolPiece]; kinds: HarmonyKind[] }[] {
  const ps = [...new Map(pool(side).map((p) => [`${p.shape}${p.value}`, p])).values()].sort((a, b) => a.value - b.value);
  const out: { pieces: [PoolPiece, PoolPiece, PoolPiece]; kinds: HarmonyKind[] }[] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++)
      for (let k = j + 1; k < ps.length; k++) {
        const [a, b, c] = [ps[i]!, ps[j]!, ps[k]!];
        if (a.value === b.value || b.value === c.value) continue;
        const kinds = harmonyKinds(a.value, b.value, c.value);
        if (kinds.length > 0) out.push({ pieces: [a, b, c], kinds });
      }
  return out;
}

// ---------------------------------------------------------------------------
// Generation.

const DIRS = [
  { df: 1, dr: 0 },
  { df: 0, dr: 1 },
  { df: 1, dr: 1 },
  { df: 1, dr: -1 },
];

interface Layout {
  readonly a: Square;
  readonly middle: Square;
  readonly c: Square;
}

function layouts(side: Side, rnd: () => number): Layout[] {
  const out: Layout[] = [];
  const { files, ranks } = mebben.board;
  for (let attempt = 0; attempt < 200; attempt++) {
    const spacing = 1 + Math.floor(rnd() * 3);
    const d = DIRS[Math.floor(rnd() * DIRS.length)]!;
    const a: Square = { file: Math.floor(rnd() * files), rank: Math.floor(rnd() * ranks) };
    const middle: Square = { file: a.file + d.df * spacing, rank: a.rank + d.dr * spacing };
    let c: Square;
    if (rnd() < 0.6) {
      c = { file: middle.file + d.df * spacing, rank: middle.rank + d.dr * spacing }; // line
    } else {
      const perp = { df: -d.dr, dr: d.df };
      const s = rnd() < 0.5 ? 1 : -1;
      c = { file: middle.file + perp.df * spacing * s, rank: middle.rank + perp.dr * spacing * s }; // angle, corner at the middle
    }
    const all = [a, middle, c];
    if (all.every((q) => q.file >= 0 && q.file < files && q.rank >= 0 && q.rank < ranks && isEnemyHalf(mebben, side, q))) out.push({ a, middle, c });
    if (out.length >= 20) break;
  }
  return out;
}

function randomSquare(rnd: () => number, taken: Set<string>, pred: (sq: Square) => boolean): Square | null {
  const { files, ranks } = mebben.board;
  for (let i = 0; i < 100; i++) {
    const sq = { file: Math.floor(rnd() * files), rank: Math.floor(rnd() * ranks) };
    const key = squareName(sq);
    if (taken.has(key) || !pred(sq)) continue;
    taken.add(key);
    return sq;
  }
  return null;
}

/** Try to build one puzzle from a seed. Null when the attempt does not verify. */
export function tryBuild(date: string, seed: number, rnd: () => number): MiddlesPuzzle | null {
  const side: Side = rnd() < 0.5 ? 'white' : 'black';
  const enemy: Side = side === 'white' ? 'black' : 'white';
  const triples = harmonicTriples(side);
  const triple = triples[Math.floor(rnd() * triples.length)]!;
  const [pa, pb, pc] = triple.pieces;
  const layoutOptions = layouts(side, rnd);
  if (layoutOptions.length === 0) return null;
  const layout = layoutOptions[Math.floor(rnd() * layoutOptions.length)]!;

  const taken = new Set<string>([squareName(layout.a), squareName(layout.middle), squareName(layout.c)]);
  const inputs: PieceInput[] = [
    { id: 'a', side, shape: pa.shape, value: pa.value, square: layout.a },
    { id: 'c', side, shape: pc.shape, value: pc.value, square: layout.c },
  ];
  // the middle stone starts one regular move away from its square
  const probe = place([...inputs, { id: 'm', side, shape: pb.shape, value: pb.value, square: layout.middle }], side);
  const middlePiece = probe.pieces.find((p) => p.id === 'm')!;
  const origins = reachableSquares(probe, middlePiece).map((r) => r.square);
  if (origins.length === 0) return null;
  const from = origins[Math.floor(rnd() * origins.length)]!;
  taken.add(squareName(from));
  inputs.push({ id: 'm', side, shape: pb.shape, value: pb.value, square: from });

  // distractors: own stones and enemy stones on free squares
  const ownExtra = 1 + Math.floor(rnd() * 3);
  const enemyExtra = 1 + Math.floor(rnd() * 3);
  const ownPool = pool(side).filter((p) => ![pa, pb, pc].some((t) => t.shape === p.shape && t.value === p.value));
  const enemyPool = pool(enemy);
  for (let i = 0; i < ownExtra; i++) {
    const p = ownPool[Math.floor(rnd() * ownPool.length)]!;
    const sq = randomSquare(rnd, taken, () => true);
    if (sq) inputs.push({ id: `o${i}`, side, shape: p.shape, value: p.value, square: sq });
  }
  for (let i = 0; i < enemyExtra; i++) {
    const p = enemyPool[Math.floor(rnd() * enemyPool.length)]!;
    const sq = randomSquare(rnd, taken, () => true);
    if (sq) inputs.push({ id: `e${i}`, side: enemy, shape: p.shape, value: p.value, square: sq });
  }

  const position = place(inputs, side);
  if (findHarmonies(position, side).length > 0) return null;
  const result = solvePuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 });
  if (!result.unique || result.solutions.length !== 1) return null;
  const sol = result.solutions[0]!;
  const move = sol.turns[0]!.move;
  if (move.pieceId !== 'm' || squareName(move.to) !== squareName(layout.middle)) return null;

  const ownCount = inputs.filter((p) => p.side === side).length;
  const difficulty: 1 | 2 | 3 = triple.kinds.includes('arithmetic') && ownCount <= 4 ? 1 : triple.kinds.includes('musical') || ownCount >= 6 ? 3 : 2;
  return {
    date,
    seed,
    side,
    pieces: position.pieces.map((p) => ({ id: p.id, side: p.side, shape: p.shape as SimpleShape, value: p.value, square: squareName(p.square) })),
    goal: { kind: 'harmony' },
    solution: { pieceId: 'm', from: squareName(from), to: squareName(layout.middle) },
    harmony: { kinds: sol.harmony!.kinds, values: sol.harmony!.values },
    difficulty,
  };
}

/** The puzzle for a date. Tries seeds derived from the date until one verifies. */
export function generateMiddles(date: string, maxAttempts = 500): MiddlesPuzzle {
  const base = seedForDate(date);
  for (let i = 0; i < maxAttempts; i++) {
    const seed = (base + i * 7919) >>> 0;
    const puzzle = tryBuild(date, seed, mulberry32(seed));
    if (puzzle) return puzzle;
  }
  throw new Error(`no verifiable Middles puzzle for ${date} within ${maxAttempts} attempts`);
}

/** Re-check a puzzle with the solver: unique, and the stored solution is the one. */
export function verifyMiddles(puzzle: MiddlesPuzzle): { valid: boolean; reason: string } {
  const position = place(
    puzzle.pieces.map((p) => ({ id: p.id, side: p.side, shape: p.shape, value: p.value, at: p.square })),
    puzzle.side,
  );
  const result = solvePuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 });
  if (result.solutions.length === 0) return { valid: false, reason: 'no solution' };
  if (!result.unique) return { valid: false, reason: `${result.solutions.length} solutions` };
  const move = result.solutions[0]!.turns[0]!.move;
  const ok = move.pieceId === puzzle.solution.pieceId && squareName(move.from) === puzzle.solution.from && squareName(move.to) === puzzle.solution.to;
  return ok ? { valid: true, reason: 'unique and as stored' } : { valid: false, reason: 'solution differs from the stored one' };
}

/** ISO date (UTC) for a timestamp. */
export function isoDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
