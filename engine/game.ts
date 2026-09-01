/**
 * A turn: one regular move, then the captures the player declares against
 * the resulting position (rules.captureTiming = 'after_move'). Victory is
 * checked for the mover after the captures.
 */
import { opponent } from './board';
import { applyCapture, findCaptures } from './capture';
import type { Capture } from './capture';
import { victoryOf } from './harmony';
import type { Harmony } from './harmony';
import { applyMove, isLegalMove, moveToString } from './moves';
import type { Move } from './moves';
import type { Position, Side } from './types';

export interface Turn {
  readonly move: Move;
  readonly captures: readonly Capture[];
}

export interface TurnResult {
  readonly position: Position;
  /** Harmony that wins the game for the mover, if any. */
  readonly victory: Harmony | null;
  readonly winner: Side | null;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function matchingCapture(available: readonly Capture[], declared: Capture): Capture | undefined {
  return available.find(
    (c) => c.method === declared.method && c.target === declared.target && c.component === declared.component && sameSet(c.by, declared.by),
  );
}

/** Play a turn. Throws on an illegal move or a capture that does not hold. */
export function playTurn(pos: Position, turn: Turn): TurnResult {
  const side = pos.sideToMove;
  if (!isLegalMove(pos, turn.move)) throw new Error(`illegal move: ${moveToString(turn.move)}`);
  let next = applyMove(pos, turn.move);
  for (const declared of turn.captures) {
    const hit = matchingCapture(findCaptures(next, side), declared);
    if (!hit) throw new Error(`capture does not hold: ${declared.method} ${declared.by.join('+')} on ${declared.target}`);
    next = applyCapture(next, hit);
  }
  const victory = victoryOf(next, side);
  const flipped: Position = { ...next, sideToMove: opponent(side) };
  return { position: flipped, victory, winner: victory ? side : null };
}

/** Every capture the mover can take after the move, applied greedily in the order found. */
export function greedyCaptures(pos: Position, move: Move): Capture[] {
  const side = pos.sideToMove;
  let next = applyMove(pos, move);
  const taken: Capture[] = [];
  for (;;) {
    const available = findCaptures(next, side);
    const pick = available.find((c) => !taken.some((t) => t.target === c.target && t.component === c.component));
    if (!pick) break;
    taken.push(pick);
    next = applyCapture(next, pick);
  }
  return taken;
}

/** A turn that takes everything it can. Used by the opponent and the solver. */
export function autoTurn(pos: Position, move: Move): Turn {
  return { move, captures: greedyCaptures(pos, move) };
}

export function turnToString(turn: Turn): string {
  const caps = turn.captures.map((c) => `${c.method} x${c.target}${c.component === undefined ? '' : `[${c.component}]`}`);
  return caps.length ? `${moveToString(turn.move)} (${caps.join(', ')})` : moveToString(turn.move);
}
