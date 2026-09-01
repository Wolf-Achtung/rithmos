/**
 * The opponent. Negamax with alpha-beta over a beam of the best-looking
 * moves; strength comes from search depth, beam breadth and evaluation
 * noise. The evaluation measures harmony proximity, because material means
 * little in a game won by construction (CLAUDE.md section 4).
 *
 * Every result carries the intent behind the chosen move as structured
 * data. A language model may phrase it; it decides nothing.
 */
import { isEnemyHalf, opponent, piecesOf } from './board';
import { findCaptures } from './capture';
import type { Capture } from './capture';
import { autoTurn, playTurn } from './game';
import type { Turn, TurnResult } from './game';
import { harmonyKey, reachableHarmonies, victoryOf } from './harmony';
import type { Arrangement, Harmony, HarmonyKind, ReachableHarmony } from './harmony';
import { legalMoves } from './moves';
import type { PieceId, Position, Side, VictoryClass } from './types';

export interface SearchOptions {
  /** Plies to look ahead. 1 = own move only. */
  readonly depth: number;
  /** Moves kept per node after ordering. */
  readonly breadth: number;
  /** Uniform noise added to leaf evaluations, in evaluation points. 0 = none. */
  readonly noise: number;
  readonly seed?: number;
}

export const STRENGTH_PRESETS: Readonly<Record<'novice' | 'apprentice' | 'master', SearchOptions>> = {
  novice: { depth: 1, breadth: 8, noise: 60 },
  apprentice: { depth: 2, breadth: 10, noise: 15 },
  master: { depth: 3, breadth: 6, noise: 0 },
};

export const WIN_SCORE = 100_000;

const VICTORY_WEIGHT: Record<VictoryClass, number> = { minor: 120, major: 220, greatest: 320 };

export interface HarmonySummary {
  readonly kinds: readonly HarmonyKind[];
  readonly values: readonly number[];
  readonly pieces: readonly PieceId[];
  readonly arrangement: Arrangement;
  readonly victory: VictoryClass;
  /** Board region by file, seen from white: a-c left, d-e center, f-h right. */
  readonly region: 'left' | 'center' | 'right';
}

export type Intent =
  | { kind: 'complete_harmony'; harmony: HarmonySummary }
  | { kind: 'capture'; captures: readonly Capture[] }
  | { kind: 'build_harmony'; harmony: HarmonySummary; movesAway: number; threatenedBy: readonly PieceId[] }
  | { kind: 'escape'; piece: PieceId; from: readonly PieceId[] }
  | { kind: 'block'; opponentPieces: readonly PieceId[]; harmony: HarmonySummary }
  | { kind: 'develop'; piece: PieceId; intoEnemyHalf: boolean };

export interface SearchResult {
  readonly turn: Turn;
  readonly score: number;
  readonly intent: Intent;
  /** Principal variation, starting with `turn`. */
  readonly line: readonly Turn[];
  readonly nodes: number;
}

// ---------------------------------------------------------------------------
// Evaluation.

function sideScore(pos: Position, side: Side): number {
  let score = 0;
  for (const h of reachableHarmonies(pos, side, 1)) {
    score += VICTORY_WEIGHT[h.victory] * (h.via.length === 0 ? 3 : 1);
  }
  const own = piecesOf(pos, side);
  score += 2 * own.length;
  for (const p of own) if (isEnemyHalf(pos.rules, side, p.square)) score += 3;
  const threatened = new Set(findCaptures(pos, side).map((c) => c.target));
  score += 8 * threatened.size;
  return score;
}

/** Static evaluation from `side`'s point of view. Positive is good for `side`. */
export function evaluate(pos: Position, side: Side): number {
  if (victoryOf(pos, side)) return WIN_SCORE;
  if (victoryOf(pos, opponent(side))) return -WIN_SCORE;
  return sideScore(pos, side) - sideScore(pos, opponent(side));
}

// ---------------------------------------------------------------------------
// Search.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ctx {
  readonly opts: SearchOptions;
  readonly rnd: () => number;
  nodes: number;
}

interface Child {
  readonly turn: Turn;
  readonly result: TurnResult;
  readonly staticScore: number;
}

function children(pos: Position, ctx: Ctx): Child[] {
  const side = pos.sideToMove;
  const out: Child[] = [];
  for (const move of legalMoves(pos)) {
    const turn = autoTurn(pos, move);
    const result = playTurn(pos, turn);
    ctx.nodes++;
    const staticScore = result.winner === side ? WIN_SCORE : evaluate(result.position, side);
    out.push({ turn, result, staticScore });
  }
  out.sort((a, b) => b.staticScore - a.staticScore);
  return out;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number, ctx: Ctx): { score: number; line: Turn[] } {
  const kids = children(pos, ctx);
  if (kids.length === 0) return { score: -WIN_SCORE / 2, line: [] };
  const win = kids.find((k) => k.result.winner === pos.sideToMove);
  if (win) return { score: WIN_SCORE - ply, line: [win.turn] };
  if (depth <= 1) {
    let best = kids[0]!;
    let bestScore = -Infinity;
    for (const k of kids) {
      const s = k.staticScore + (ctx.opts.noise > 0 ? (ctx.rnd() * 2 - 1) * ctx.opts.noise : 0);
      if (s > bestScore) {
        bestScore = s;
        best = k;
      }
    }
    return { score: bestScore, line: [best.turn] };
  }
  let bestScore = -Infinity;
  let bestLine: Turn[] = [];
  for (const k of kids.slice(0, Math.max(1, ctx.opts.breadth))) {
    const reply = negamax(k.result.position, depth - 1, -beta, -alpha, ply + 1, ctx);
    const s = -reply.score;
    if (s > bestScore) {
      bestScore = s;
      bestLine = [k.turn, ...reply.line];
    }
    alpha = Math.max(alpha, s);
    if (alpha >= beta) break;
  }
  return { score: bestScore, line: bestLine };
}

/** Choose a turn for the side to move. Null when it has no legal move. */
export function chooseMove(pos: Position, opts: SearchOptions = STRENGTH_PRESETS.apprentice): SearchResult | null {
  const ctx: Ctx = { opts, rnd: mulberry32(opts.seed ?? 1), nodes: 0 };
  const { score, line } = negamax(pos, Math.max(1, opts.depth), -Infinity, Infinity, 0, ctx);
  const turn = line[0];
  if (!turn) return null;
  return { turn, score, intent: deriveIntent(pos, turn), line, nodes: ctx.nodes };
}

// ---------------------------------------------------------------------------
// Intent.

function region(h: Harmony): HarmonySummary['region'] {
  const mean = h.squares.reduce((s, q) => s + q.file, 0) / h.squares.length;
  return mean < 3 ? 'left' : mean > 4 ? 'right' : 'center';
}

export function summarize(h: Harmony): HarmonySummary {
  return { kinds: h.kinds, values: h.values, pieces: h.pieces, arrangement: h.arrangement, victory: h.victory, region: region(h) };
}

function best(hs: readonly ReachableHarmony[]): ReachableHarmony | undefined {
  return [...hs].sort((a, b) => VICTORY_WEIGHT[b.victory] - VICTORY_WEIGHT[a.victory] || a.via.length - b.via.length)[0];
}

/** What the chosen turn is for, derived from the engine's own facts. */
export function deriveIntent(pos: Position, turn: Turn): Intent {
  const side = pos.sideToMove;
  const enemy = opponent(side);
  const result = playTurn(pos, turn);
  const after = result.position;
  if (result.victory) return { kind: 'complete_harmony', harmony: summarize(result.victory) };
  if (turn.captures.length > 0) return { kind: 'capture', captures: turn.captures };

  const beforeKeys = new Set(reachableHarmonies(pos, side, 1).map((h) => harmonyKey(h.pieces)));
  const fresh = reachableHarmonies(after, side, 1).filter((h) => !beforeKeys.has(harmonyKey(h.pieces)));
  const threatsAfter = findCaptures(after, enemy);
  const pick1 = best(fresh);
  if (pick1) {
    const threatenedBy = threatsAfter.filter((c) => pick1.pieces.includes(c.target)).flatMap((c) => c.by);
    return { kind: 'build_harmony', harmony: summarize(pick1), movesAway: 1, threatenedBy: [...new Set(threatenedBy)] };
  }

  const threatsBefore = findCaptures(pos, enemy).filter((c) => c.target === turn.move.pieceId);
  if (threatsBefore.length > 0 && !threatsAfter.some((c) => c.target === turn.move.pieceId)) {
    return { kind: 'escape', piece: turn.move.pieceId, from: [...new Set(threatsBefore.flatMap((c) => c.by))] };
  }

  const enemyAfter = new Set(reachableHarmonies(after, enemy, 1).map((h) => harmonyKey(h.pieces)));
  const blocked = best(reachableHarmonies(pos, enemy, 1).filter((h) => !enemyAfter.has(harmonyKey(h.pieces))));
  if (blocked) return { kind: 'block', opponentPieces: blocked.pieces, harmony: summarize(blocked) };

  const before2 = new Set(reachableHarmonies(pos, side, 2).map((h) => harmonyKey(h.pieces)));
  const fresh2 = reachableHarmonies(after, side, 2).filter((h) => !before2.has(harmonyKey(h.pieces)));
  const pick2 = best(fresh2);
  if (pick2) {
    const threatenedBy = threatsAfter.filter((c) => pick2.pieces.includes(c.target)).flatMap((c) => c.by);
    return { kind: 'build_harmony', harmony: summarize(pick2), movesAway: 2, threatenedBy: [...new Set(threatenedBy)] };
  }

  return { kind: 'develop', piece: turn.move.pieceId, intoEnemyHalf: isEnemyHalf(pos.rules, side, turn.move.to) };
}
