/**
 * The small board (CLAUDE.md, Stufe 4): a reducer over engine calls. The
 * engine decides everything — legal moves, captures, victory, whether a move
 * is strong, whether a reason holds. The store only sequences phases and
 * remembers what the player tapped. Pure, no React, no I/O.
 */
import { opponent, pieceAt, pieceById, squareIndex } from '../../../engine/board';
import { findCaptures } from '../../../engine/capture';
import { verifyClaim } from '../../../engine/claims';
import type { Claim } from '../../../engine/claims';
import { autoTurn, playTurn } from '../../../engine/game';
import type { Turn, TurnResult } from '../../../engine/game';
import { reachableHarmonies, victoryOf } from '../../../engine/harmony';
import type { Harmony, ReachableHarmony } from '../../../engine/harmony';
import { applyMove, legalMovesOf } from '../../../engine/moves';
import type { Move } from '../../../engine/moves';
import { initialPosition } from '../../../engine/board';
import { small } from '../../../engine/rules/small';
import type { Intent } from '../../../engine/search';
import type { PieceId, Position, Side, Square } from '../../../engine/types';

export type Phase = 'move' | 'reason' | 'opponent' | 'over';

/** A reason the player may give before the move, built from what the engine sees. */
export interface ReasonOffer {
  readonly id: string;
  readonly claim: Claim;
  /** for the wording: the pieces' values and, for a harmony, its numbers */
  readonly values: readonly number[];
  readonly kind: 'close' | 'build' | 'threat' | 'escape';
}

/** The four fields of CLAUDE.md 6, plus "no reason given". */
export type Verdict = 'understood' | 'luck' | 'slip' | 'misread' | 'none';

export interface SmallState {
  readonly humanSide: Side;
  readonly position: Position;
  readonly phase: Phase;
  readonly selected: PieceId | null;
  readonly pending: Move | null;
  readonly reasons: readonly ReasonOffer[];
  readonly verdict: Verdict | null;
  readonly verdictEvidence: string | null;
  readonly lastMove: Move | null;
  readonly lastIntent: Intent | null;
  readonly winner: Side | null;
  readonly victory: Harmony | null;
  readonly turn: number;
  /** how the four fields fell over the match: for the coverage later */
  readonly verdicts: readonly Verdict[];
}

export type SmallAction =
  | { type: 'new_game'; humanSide: Side }
  | { type: 'tap'; square: Square }
  | { type: 'reason'; id: string | null; strong: boolean }
  | { type: 'opponent_played'; turn: Turn; result: TurnResult; intent: Intent }
  | { type: 'opponent_passed' };

export function newSmallGame(humanSide: Side): SmallState {
  const position = initialPosition(small);
  return {
    humanSide,
    position,
    phase: humanSide === 'white' ? 'move' : 'opponent',
    selected: null,
    pending: null,
    reasons: [],
    verdict: null,
    verdictEvidence: null,
    lastMove: null,
    lastIntent: null,
    winner: null,
    victory: null,
    turn: 1,
    verdicts: [],
  };
}

/** Squares the selected stone may move to. */
export function targetsOf(state: SmallState): Set<number> {
  const out = new Set<number>();
  if (!state.selected) return out;
  const piece = pieceById(state.position, state.selected);
  if (!piece) return out;
  for (const m of legalMovesOf(state.position, piece)) out.add(squareIndex(state.position.rules, m.to));
  return out;
}

/** Reasons the engine can check for this move: harmonies it closes or prepares, threats it makes, threats it leaves. */
export function reasonsFor(pos: Position, move: Move): ReasonOffer[] {
  const side = pos.sideToMove;
  const enemy = opponent(side);
  const after = applyMove(pos, move);
  const offers: ReasonOffer[] = [];
  const seen = new Set<string>();
  const harmonies = reachableHarmonies(after, side, 1).filter((h) => h.pieces.includes(move.pieceId));
  const byDistance = [...harmonies].sort((a, b) => a.via.length - b.via.length);
  for (const h of byDistance.slice(0, 2)) {
    const key = h.pieces.join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    const standing = h.via.length === 0;
    offers.push({
      id: `harmony:${key}`,
      claim: { kind: 'harmony_reachable', pieces: [...h.pieces], withinMoves: standing ? 0 : 1 },
      values: h.values,
      kind: standing ? 'close' : 'build',
    });
  }
  const threat = findCaptures(after, side).find((c) => c.by.includes(move.pieceId));
  if (threat) {
    const target = pieceById(after, threat.target);
    if (target) offers.push({ id: `threat:${threat.target}`, claim: { kind: 'capture_threat', from: move.pieceId, to: threat.target, method: 'meeting' }, values: [target.value], kind: 'threat' });
  }
  const hunter = findCaptures(pos, enemy).find((c) => c.target === move.pieceId);
  if (hunter) {
    const attacker = pieceById(pos, hunter.by[0]!);
    if (attacker) offers.push({ id: `escape:${attacker.id}`, claim: { kind: 'escapes', piece: move.pieceId, from: attacker.id }, values: [attacker.value], kind: 'escape' });
  }
  return offers;
}

/** The field a move falls into: strong or weak, reason holds or not. */
export function judge(strong: boolean, holds: boolean | null): Verdict {
  if (holds === null) return 'none';
  if (strong) return holds ? 'understood' : 'luck';
  return holds ? 'slip' : 'misread';
}

export function reduceSmall(state: SmallState, action: SmallAction): SmallState {
  switch (action.type) {
    case 'new_game':
      return newSmallGame(action.humanSide);

    case 'tap': {
      if (state.phase !== 'move') return state;
      const pos = state.position;
      const piece = pieceAt(pos, action.square);
      if (piece && piece.side === state.humanSide) {
        return { ...state, selected: state.selected === piece.id ? null : piece.id };
      }
      if (!state.selected) return state;
      const idx = squareIndex(pos.rules, action.square);
      if (!targetsOf(state).has(idx)) return { ...state, selected: null };
      const move: Move = { pieceId: state.selected, from: pieceById(pos, state.selected)!.square, to: action.square };
      return { ...state, phase: 'reason', pending: move, reasons: reasonsFor(pos, move), verdict: null, verdictEvidence: null };
    }

    case 'reason': {
      if (state.phase !== 'reason' || !state.pending) return state;
      const pos = state.position;
      const move = state.pending;
      const offer = action.id ? state.reasons.find((r) => r.id === action.id) : undefined;
      const check = offer ? verifyClaim(pos, move, offer.claim) : null;
      const verdict = judge(action.strong, check ? check.holds : null);
      const result = playTurn(pos, autoTurn(pos, move));
      const over = result.winner !== null;
      return {
        ...state,
        position: result.position,
        phase: over ? 'over' : 'opponent',
        selected: null,
        pending: null,
        reasons: [],
        verdict,
        verdictEvidence: check?.evidence ?? null,
        lastMove: move,
        lastIntent: null,
        winner: result.winner,
        victory: result.victory,
        verdicts: [...state.verdicts, verdict],
      };
    }

    case 'opponent_played': {
      if (state.phase !== 'opponent') return state;
      const over = action.result.winner !== null;
      return {
        ...state,
        position: action.result.position,
        phase: over ? 'over' : 'move',
        lastMove: action.turn.move,
        lastIntent: action.intent,
        winner: action.result.winner,
        victory: action.result.victory,
        turn: state.turn + 1,
      };
    }

    case 'opponent_passed':
      return state.phase === 'opponent' ? { ...state, phase: 'move', turn: state.turn + 1 } : state;
  }
}

/** Squares of the winning harmony, for the highlight. */
export function victorySquares(state: SmallState): Set<number> {
  const out = new Set<number>();
  const v = state.victory ?? victoryOf(state.position, state.humanSide);
  if (v) for (const sq of v.squares) out.add(squareIndex(state.position.rules, sq));
  return out;
}

export type { ReachableHarmony };
