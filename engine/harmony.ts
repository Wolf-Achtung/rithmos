/**
 * Harmonies (proportions) and victory conditions.
 *
 * Recognition is implemented twice: once with Mebben's conditions, once with
 * the formulas of the three Pythagorean means. A test checks both agree on
 * every triple. Production code uses the Mebben conditions.
 *
 * This module also enumerates the harmonies a side can reach with its own
 * moves. That enumeration has two clients, the coverage metric and the search
 * evaluation, and is benchmarked (bench/harmony.bench.ts, BENCHMARK.md).
 */
import { isEnemyHalf, piecesOf, squareIndex } from './board';
import { applyMove, legalMoves, reachableSquares } from './moves';
import type { Move } from './moves';
import type { PieceId, PlacedPiece, Position, Side, Square, VictoryClass } from './types';

export type HarmonyKind = 'arithmetic' | 'geometric' | 'musical';
export const HARMONY_KINDS: readonly HarmonyKind[] = ['arithmetic', 'geometric', 'musical'];

export type Arrangement = 'line' | 'angle' | 'square';

export interface Harmony {
  /** Pieces in reading order: along the line, or ends-corner-ends for an angle, or by value for a square. */
  readonly pieces: readonly PieceId[];
  readonly squares: readonly Square[];
  readonly values: readonly number[];
  readonly kinds: readonly HarmonyKind[];
  readonly arrangement: Arrangement;
  readonly victory: VictoryClass;
}

export interface ReachableHarmony extends Harmony {
  /** Own moves that produce it; empty when it already stands. */
  readonly via: readonly Move[];
}

// ---------------------------------------------------------------------------
// Recognition, twice.

/** Mebben's conditions on three ascending values. */
export function harmonyKindsByMebben(a: number, b: number, c: number): HarmonyKind[] {
  if (!(a < b && b < c)) return [];
  const kinds: HarmonyKind[] = [];
  if (b - a === c - b) kinds.push('arithmetic');
  if (a * c === b * b) kinds.push('geometric'); // a : b = b : c
  if (a * (c - b) === c * (b - a)) kinds.push('musical'); // a : c = (b - a) : (c - b)
  return kinds;
}

/** The same question asked of the means: is b the arithmetic, geometric or harmonic mean of a and c? */
export function harmonyKindsByMeans(a: number, b: number, c: number): HarmonyKind[] {
  if (!(a < b && b < c)) return [];
  const kinds: HarmonyKind[] = [];
  if (2 * b === a + c) kinds.push('arithmetic'); // b = (a + c) / 2
  if (b * b === a * c) kinds.push('geometric'); // b = sqrt(a * c)
  if (b * (a + c) === 2 * a * c) kinds.push('musical'); // b = 2ac / (a + c)
  return kinds;
}

export const harmonyKinds = harmonyKindsByMebben;

/** A sequence of values read in arrangement order: ascending one way or the other. */
function ascending(values: readonly number[]): number[] | null {
  let up = true;
  let down = true;
  for (let i = 1; i < values.length; i++) {
    if (!(values[i]! > values[i - 1]!)) up = false;
    if (!(values[i]! < values[i - 1]!)) down = false;
  }
  if (up) return [...values];
  if (down) return [...values].reverse();
  return null;
}

/**
 * Kinds present among four ascending values: every harmony among its triples,
 * plus the four-term geometric proportion a : b = c : d.
 */
export function harmonyKindsOfFour(v: readonly number[]): HarmonyKind[] {
  if (v.length !== 4) throw new Error('four values expected');
  const [a, b, c, d] = v as [number, number, number, number];
  if (!(a < b && b < c && c < d)) return [];
  const set = new Set<HarmonyKind>();
  for (const [x, y, z] of [
    [a, b, c],
    [a, b, d],
    [a, c, d],
    [b, c, d],
  ] as const) {
    for (const k of harmonyKinds(x, y, z)) set.add(k);
  }
  if (a * d === b * c) set.add('geometric');
  return HARMONY_KINDS.filter((k) => set.has(k));
}

// ---------------------------------------------------------------------------
// Geometry.

interface Vec {
  readonly df: number;
  readonly dr: number;
}

const sub = (a: Square, b: Square): Vec => ({ df: a.file - b.file, dr: a.rank - b.rank });
const eq = (a: Vec, b: Vec) => a.df === b.df && a.dr === b.dr;
const dot = (a: Vec, b: Vec) => a.df * b.df + a.dr * b.dr;
const len2 = (a: Vec) => a.df * a.df + a.dr * a.dr;
/** Straight on the board: orthogonal or diagonal, not zero. */
const isLineDirection = (v: Vec) => (v.df === 0) !== (v.dr === 0) || (v.df !== 0 && Math.abs(v.df) === Math.abs(v.dr));

function sortedByPosition(squares: readonly Square[]): number[] {
  return squares.map((_, i) => i).sort((i, j) => squares[i]!.rank - squares[j]!.rank || squares[i]!.file - squares[j]!.file);
}

export interface Geometry {
  readonly arrangement: Arrangement;
  /** Indices into the input, in reading order. */
  readonly order: readonly number[];
}

/** Line with equal spacing, or right angle with equal legs. */
export function geometryOfThree(sq: readonly Square[]): Geometry | null {
  const idx = sortedByPosition(sq);
  const v1 = sub(sq[idx[1]!]!, sq[idx[0]!]!);
  const v2 = sub(sq[idx[2]!]!, sq[idx[1]!]!);
  if (eq(v1, v2) && isLineDirection(v1)) return { arrangement: 'line', order: idx };
  for (const c of [0, 1, 2]) {
    const [p, q] = [0, 1, 2].filter((i) => i !== c) as [number, number];
    const a = sub(sq[p]!, sq[c]!);
    const b = sub(sq[q]!, sq[c]!);
    if (isLineDirection(a) && isLineDirection(b) && dot(a, b) === 0 && len2(a) === len2(b)) {
      return { arrangement: 'angle', order: [p, c, q] };
    }
  }
  return null;
}

/** Line of four with equal spacing, or the corners of a square (axis-aligned or tilted). */
export function geometryOfFour(sq: readonly Square[]): Geometry | null {
  const idx = sortedByPosition(sq);
  const v1 = sub(sq[idx[1]!]!, sq[idx[0]!]!);
  const v2 = sub(sq[idx[2]!]!, sq[idx[1]!]!);
  const v3 = sub(sq[idx[3]!]!, sq[idx[2]!]!);
  if (eq(v1, v2) && eq(v2, v3) && isLineDirection(v1)) return { arrangement: 'line', order: idx };
  const d: number[] = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) d.push(len2(sub(sq[i]!, sq[j]!)));
  d.sort((a, b) => a - b);
  const s = d[0]!;
  if (s > 0 && d[1] === s && d[2] === s && d[3] === s && d[4] === 2 * s && d[5] === 2 * s) {
    return { arrangement: 'square', order: [0, 1, 2, 3] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Harmonies on the board.

function victoryFor(pos: Position, count: number, kinds: readonly HarmonyKind[]): VictoryClass | null {
  const v = pos.rules.victory;
  if (count === v.minor.pieces && kinds.length >= v.minor.harmonies) return 'minor';
  if (count === v.greatest.pieces && kinds.length >= v.greatest.harmonies) return 'greatest';
  if (count === v.major.pieces && (v.major.exactly ? kinds.length === v.major.harmonies : kinds.length >= v.major.harmonies)) return 'major';
  return null;
}

/**
 * Is this group of three or four own pieces a harmony? Requires every piece in
 * the enemy half, a valid arrangement and a proportion read in that order.
 */
export function harmonyOf(pos: Position, group: readonly PlacedPiece[]): Harmony | null {
  const side = group[0]!.side;
  for (const p of group) if (p.side !== side || !isEnemyHalf(pos.rules, side, p.square)) return null;
  const squares = group.map((p) => p.square);
  const geo = group.length === 3 ? geometryOfThree(squares) : group.length === 4 ? geometryOfFour(squares) : null;
  if (!geo) return null;
  let ordered = geo.order.map((i) => group[i]!);
  let values: number[] | null;
  if (geo.arrangement === 'square') {
    ordered = [...ordered].sort((a, b) => a.value - b.value);
    values = ordered.map((p) => p.value);
    for (let i = 1; i < values.length; i++) if (values[i] === values[i - 1]) return null;
  } else {
    values = ascending(ordered.map((p) => p.value));
    if (!values) return null;
    if (values[0] !== ordered[0]!.value) ordered = [...ordered].reverse();
  }
  const kinds = group.length === 3 ? harmonyKinds(values[0]!, values[1]!, values[2]!) : harmonyKindsOfFour(values);
  const victory = victoryFor(pos, group.length, kinds);
  if (!victory) return null;
  return {
    pieces: ordered.map((p) => p.id),
    squares: ordered.map((p) => p.square),
    values,
    kinds,
    arrangement: geo.arrangement,
    victory,
  };
}

const VICTORY_RANK: Record<VictoryClass, number> = { minor: 1, major: 2, greatest: 3 };

export function compareVictory(a: VictoryClass, b: VictoryClass): number {
  return VICTORY_RANK[a] - VICTORY_RANK[b];
}

export function harmonyKey(pieces: readonly PieceId[]): string {
  return [...pieces].sort().join('|');
}

function candidates(pos: Position, side: Side): PlacedPiece[] {
  return piecesOf(pos, side).filter((p) => isEnemyHalf(pos.rules, side, p.square));
}

/** Every harmony `side` has on the board right now. */
export function findHarmonies(pos: Position, side: Side): Harmony[] {
  const ps = candidates(pos, side);
  const out: Harmony[] = [];
  const n = ps.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const h = harmonyOf(pos, [ps[i]!, ps[j]!, ps[k]!]);
        if (h) out.push(h);
        for (let l = k + 1; l < n; l++) {
          const h4 = harmonyOf(pos, [ps[i]!, ps[j]!, ps[k]!, ps[l]!]);
          if (h4) out.push(h4);
        }
      }
  return out;
}

/** The best harmony a side holds, or null. */
export function victoryOf(pos: Position, side: Side): Harmony | null {
  let best: Harmony | null = null;
  for (const h of findHarmonies(pos, side)) {
    if (!best || compareVictory(h.victory, best.victory) > 0) best = h;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Reachable harmonies.

function addCandidate(set: Map<number, Square>, pos: Position, sq: Square): void {
  if (sq.file < 0 || sq.file >= pos.rules.board.files || sq.rank < 0 || sq.rank >= pos.rules.board.ranks) return;
  set.set(squareIndex(pos.rules, sq), sq);
}

/** Squares where a third piece would complete a line or an angle with p and q. */
function thirdSquares(pos: Position, p: Square, q: Square): Map<number, Square> {
  const out = new Map<number, Square>();
  const v = sub(q, p);
  if (!isLineDirection(v)) {
    // p and q could still be the two ends of an angle whose corner lies off their line
    // corner c: (c - p) ⟂ (c - q), |c - p| = |c - q|  =>  c = mid ± rot90(v) / 2
    const cx2 = p.file + q.file;
    const cy2 = p.rank + q.rank;
    for (const s of [1, -1]) {
      const fx2 = cx2 + s * -v.dr;
      const fy2 = cy2 + s * v.df;
      if (fx2 % 2 === 0 && fy2 % 2 === 0) addCandidate(out, pos, { file: fx2 / 2, rank: fy2 / 2 });
    }
    return out;
  }
  // line extensions and the midpoint
  addCandidate(out, pos, { file: p.file - v.df, rank: p.rank - v.dr });
  addCandidate(out, pos, { file: q.file + v.df, rank: q.rank + v.dr });
  if (v.df % 2 === 0 && v.dr % 2 === 0) addCandidate(out, pos, { file: p.file + v.df / 2, rank: p.rank + v.dr / 2 });
  // angle with the corner at p or at q
  const perp: Vec = { df: -v.dr, dr: v.df };
  for (const s of [1, -1]) {
    addCandidate(out, pos, { file: p.file + s * perp.df, rank: p.rank + s * perp.dr });
    addCandidate(out, pos, { file: q.file + s * perp.df, rank: q.rank + s * perp.dr });
  }
  // p and q as the ends of an angle
  const cx2 = p.file + q.file;
  const cy2 = p.rank + q.rank;
  for (const s of [1, -1]) {
    const fx2 = cx2 + s * perp.df;
    const fy2 = cy2 + s * perp.dr;
    if (fx2 % 2 === 0 && fy2 % 2 === 0) addCandidate(out, pos, { file: fx2 / 2, rank: fy2 / 2 });
  }
  return out;
}

/** Squares where a fourth piece would complete a line of four or a square with p, q, r. */
function fourthSquares(pos: Position, p: Square, q: Square, r: Square): Map<number, Square> {
  const out = new Map<number, Square>();
  const geo = geometryOfThree([p, q, r]);
  if (geo?.arrangement === 'line') {
    const sq = [p, q, r];
    const a = sq[geo.order[0]!]!;
    const c = sq[geo.order[2]!]!;
    const v = sub(sq[geo.order[1]!]!, a);
    addCandidate(out, pos, { file: a.file - v.df, rank: a.rank - v.dr });
    addCandidate(out, pos, { file: c.file + v.df, rank: c.rank + v.dr });
  } else if (geo?.arrangement === 'angle') {
    const sq = [p, q, r];
    const e1 = sq[geo.order[0]!]!;
    const corner = sq[geo.order[1]!]!;
    const e2 = sq[geo.order[2]!]!;
    addCandidate(out, pos, { file: e1.file + e2.file - corner.file, rank: e1.rank + e2.rank - corner.rank });
  } else {
    // three collinear pieces with unequal gaps: a fourth may fill the gap
    const idx = sortedByPosition([p, q, r]);
    const sq = [p, q, r];
    const a = sq[idx[0]!]!;
    const b = sq[idx[1]!]!;
    const c = sq[idx[2]!]!;
    const v1 = sub(b, a);
    const v2 = sub(c, b);
    if (isLineDirection(v1) && isLineDirection(v2)) {
      if (eq({ df: v1.df * 2, dr: v1.dr * 2 }, v2)) addCandidate(out, pos, { file: b.file + v1.df, rank: b.rank + v1.dr });
      if (eq({ df: v2.df * 2, dr: v2.dr * 2 }, v1)) addCandidate(out, pos, { file: a.file + v2.df, rank: a.rank + v2.dr });
    }
  }
  return out;
}

/**
 * Harmonies `side` can complete with its own moves, the opponent standing
 * still. `withinMoves` 0 lists the standing ones, 1 those one move away, and
 * larger values recurse over own moves (expensive: intended for claim checks,
 * not for the search).
 */
export function reachableHarmonies(pos: Position, side: Side, withinMoves = 1): ReachableHarmony[] {
  const seen = new Map<string, ReachableHarmony>();
  const add = (h: Harmony, via: Move[]) => {
    const key = harmonyKey(h.pieces);
    const prev = seen.get(key);
    if (!prev || via.length < prev.via.length) seen.set(key, { ...h, via });
  };
  for (const h of findHarmonies(pos, side)) add(h, []);
  if (withinMoves >= 1) {
    for (const h of oneMoveHarmonies(pos, side)) add(h, h.via as Move[]);
  }
  if (withinMoves >= 2) {
    for (const m of legalMoves(pos, side)) {
      const next = applyMove(pos, m);
      for (const h of reachableHarmonies(next, side, withinMoves - 1)) add(h, [m, ...h.via]);
    }
  }
  return [...seen.values()];
}

/** Target-driven enumeration of harmonies one own move away. */
function oneMoveHarmonies(pos: Position, side: Side): ReachableHarmony[] {
  const own = piecesOf(pos, side);
  const placed = candidates(pos, side);
  // who can move where
  const arrivals = new Map<number, { piece: PlacedPiece; move: Move }[]>();
  for (const piece of own) {
    for (const r of reachableSquares(pos, piece)) {
      if (!isEnemyHalf(pos.rules, side, r.square)) continue;
      const key = squareIndex(pos.rules, r.square);
      const move: Move = { pieceId: piece.id, from: piece.square, to: r.square, ...(piece.shape === 'pyramid' ? { as: r.as } : {}) };
      const list = arrivals.get(key);
      if (list) list.push({ piece, move });
      else arrivals.set(key, [{ piece, move }]);
    }
  }
  if (arrivals.size === 0) return [];
  const out: ReachableHarmony[] = [];
  const tryGroup = (group: PlacedPiece[], key: number) => {
    for (const { piece, move } of arrivals.get(key) ?? []) {
      if (group.some((g) => g.id === piece.id)) continue;
      const moved: PlacedPiece = { ...piece, square: move.to };
      const h = harmonyOf(pos, [...group, moved]);
      if (h) out.push({ ...h, via: [move] });
    }
  };
  const n = placed.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (const [key] of thirdSquares(pos, placed[i]!.square, placed[j]!.square)) {
        if (arrivals.has(key)) tryGroup([placed[i]!, placed[j]!], key);
      }
      for (let k = j + 1; k < n; k++) {
        for (const [key] of fourthSquares(pos, placed[i]!.square, placed[j]!.square, placed[k]!.square)) {
          if (arrivals.has(key)) tryGroup([placed[i]!, placed[j]!, placed[k]!], key);
        }
      }
    }
  }
  return out;
}

/** Brute force reference: play every move, look for new harmonies containing the moved piece. */
export function reachableHarmoniesBrute(pos: Position, side: Side): ReachableHarmony[] {
  const out: ReachableHarmony[] = [];
  const before = new Set(findHarmonies(pos, side).map((h) => harmonyKey(h.pieces)));
  for (const h of findHarmonies(pos, side)) out.push({ ...h, via: [] });
  for (const m of legalMoves(pos, side)) {
    const next = applyMove(pos, m);
    for (const h of findHarmonies(next, side)) {
      if (h.pieces.includes(m.pieceId) && !before.has(harmonyKey(h.pieces))) out.push({ ...h, via: [m] });
    }
  }
  return out;
}
