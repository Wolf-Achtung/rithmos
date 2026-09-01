/**
 * Puzzle verification. A puzzle is a position, a goal and a number of own
 * moves; the solver lists every turn sequence that reaches the goal and says
 * whether the solution is unique. The daily puzzle (Middles) is generated
 * elsewhere (jobs/), against this verifier.
 *
 * Move sequences longer than one count own moves only; the opponent stands
 * still, as in reachableHarmonies.
 */
import { pieceById } from './board';
import type { Capture, CaptureMethod } from './capture';
import { autoTurn, playTurn, turnToString } from './game';
import type { Turn } from './game';
import { compareVictory } from './harmony';
import type { Harmony, HarmonyKind } from './harmony';
import { legalMoves } from './moves';
import type { Move } from './moves';
import { sameSquare } from './board';
import type { PieceId, Position, VictoryClass } from './types';

export type PuzzleGoal =
  | { kind: 'harmony'; minVictory?: VictoryClass; harmony?: HarmonyKind }
  | { kind: 'capture'; target: PieceId; method?: CaptureMethod };

export interface Puzzle {
  readonly position: Position;
  readonly goal: PuzzleGoal;
  /** Own moves allowed: 1 or 2. */
  readonly movesAllowed: 1 | 2;
}

export interface Solution {
  readonly turns: readonly Turn[];
  readonly harmony?: Harmony;
  readonly capture?: Capture;
}

export interface SolveResult {
  readonly solutions: readonly Solution[];
  readonly unique: boolean;
}

function meetsHarmonyGoal(h: Harmony | null, goal: Extract<PuzzleGoal, { kind: 'harmony' }>): h is Harmony {
  if (!h) return false;
  if (goal.minVictory && compareVictory(h.victory, goal.minVictory) < 0) return false;
  if (goal.harmony && !h.kinds.includes(goal.harmony)) return false;
  return true;
}

function goalCapture(turn: Turn, goal: Extract<PuzzleGoal, { kind: 'capture' }>): Capture | undefined {
  return turn.captures.find((c) => c.target === goal.target && (!goal.method || c.method === goal.method));
}

function solveFrom(pos: Position, puzzle: Puzzle, prefix: Turn[], depth: number, out: Solution[]): void {
  const side = puzzle.position.sideToMove;
  for (const move of legalMoves(pos, side)) {
    const turn = puzzle.goal.kind === 'capture' ? autoTurn({ ...pos, sideToMove: side }, move) : { move, captures: [] };
    const result = playTurn({ ...pos, sideToMove: side }, turn);
    const turns = [...prefix, turn];
    if (puzzle.goal.kind === 'harmony') {
      if (meetsHarmonyGoal(result.victory, puzzle.goal)) {
        out.push({ turns, harmony: result.victory });
        continue;
      }
    } else {
      const cap = goalCapture(turn, puzzle.goal);
      if (cap) {
        out.push({ turns, capture: cap });
        continue;
      }
    }
    if (depth > 1 && !result.victory) solveFrom(result.position, puzzle, turns, depth - 1, out);
  }
}

/** Every solution of the puzzle. Unique means exactly one first move leads to the goal. */
export function solvePuzzle(puzzle: Puzzle): SolveResult {
  if (puzzle.goal.kind === 'capture' && !pieceById(puzzle.position, puzzle.goal.target)) {
    return { solutions: [], unique: false };
  }
  const solutions: Solution[] = [];
  solveFrom(puzzle.position, puzzle, [], puzzle.movesAllowed, solutions);
  const firstMoves = new Set(solutions.map((s) => turnToString(s.turns[0]!)));
  return { solutions, unique: firstMoves.size === 1 };
}

export interface Verification {
  readonly valid: boolean;
  readonly reason: string;
}

function sameMove(a: Move, b: Move): boolean {
  return a.pieceId === b.pieceId && sameSquare(a.from, b.from) && sameSquare(a.to, b.to);
}

/** A puzzle is valid when it has exactly one first move to the goal, and that move is the intended one. */
export function verifyPuzzle(puzzle: Puzzle, intended: Move): Verification {
  const { solutions, unique } = solvePuzzle(puzzle);
  if (solutions.length === 0) return { valid: false, reason: 'no solution' };
  if (!unique) {
    const moves = [...new Set(solutions.map((s) => turnToString(s.turns[0]!)))];
    return { valid: false, reason: `several first moves solve it: ${moves.join('; ')}` };
  }
  if (!sameMove(solutions[0]!.turns[0]!.move, intended)) {
    return { valid: false, reason: `the solution is ${turnToString(solutions[0]!.turns[0]!)}, not the intended move` };
  }
  return { valid: true, reason: `unique: ${solutions[0]!.turns.map(turnToString).join(', ')}` };
}
