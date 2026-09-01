/**
 * Game state for one match: a reducer over engine calls. The engine decides,
 * the store only sequences phases and remembers what the player tapped.
 */
import { applyCapture, findCaptures } from '../../../engine/capture';
import type { Capture } from '../../../engine/capture';
import { describeExplanation, explainCapture } from '../../../engine/explain';
import { initialPosition, isEnemyHalf, opponent, pieceAt, pieceById, squareIndex, squareName } from '../../../engine/board';
import type { Turn, TurnResult } from '../../../engine/game';
import { reachableHarmonies, victoryOf } from '../../../engine/harmony';
import type { Harmony, ReachableHarmony } from '../../../engine/harmony';
import { applyMove, legalMoves, legalMovesOf } from '../../../engine/moves';
import type { Move } from '../../../engine/moves';
import type { STRENGTH_PRESETS } from '../../../engine/search';
import type { PieceId, Position, Side, Square } from '../../../engine/types';
import { texts } from '../texts';

export type Strength = keyof typeof STRENGTH_PRESETS;
export type AssistLevel = 0 | 1 | 2 | 3;

export interface Settings {
  readonly humanSide: Side;
  readonly strength: Strength;
  readonly assist: AssistLevel;
}

export type Phase = 'mark' | 'move' | 'capture' | 'opponent' | 'over';

export interface GameState {
  readonly settings: Settings;
  readonly position: Position;
  readonly phase: Phase;
  readonly selected: PieceId | null;
  readonly attackers: readonly PieceId[];
  /** Square indices the player marked before moving. */
  readonly marked: readonly number[];
  /** Harmonies the human could reach at the start of this turn. */
  readonly reachable: readonly ReachableHarmony[];
  readonly lastMove: Move | null;
  readonly message: string;
  readonly log: readonly string[];
  readonly winner: Side | null;
  readonly victory: Harmony | null;
  readonly turnNumber: number;
  /** Coverage of the current turn's marking, null when not scored. */
  readonly coverage: number | null;
}

export type Action =
  | { type: 'new_game'; settings: Settings }
  | { type: 'tap'; square: Square }
  | { type: 'confirm_mark' }
  | { type: 'end_turn' }
  | { type: 'opponent_played'; turn: Turn; result: TurnResult }
  | { type: 'opponent_passed' };

/** Squares that belong to at least one reachable harmony, as grid indices. */
export function actualSquares(pos: Position, reachable: readonly ReachableHarmony[]): Set<number> {
  const out = new Set<number>();
  for (const h of reachable) for (const sq of h.squares) out.add(squareIndex(pos.rules, sq));
  return out;
}

export function coverageOf(marked: readonly number[], actual: ReadonlySet<number>): number | null {
  if (actual.size === 0) return null;
  let hit = 0;
  for (const m of new Set(marked)) if (actual.has(m)) hit++;
  return hit / actual.size;
}

function startHumanTurn(state: GameState, position: Position, extra: Partial<GameState> = {}): GameState {
  const human = state.settings.humanSide;
  const pos: Position = { ...position, sideToMove: human };
  const reachable = reachableHarmonies(pos, human, 1);
  const mark = state.settings.assist < 3;
  if (legalMoves(pos, human).length === 0) {
    const log = [...(extra.log ?? state.log), texts.youCannotMove];
    return { ...state, ...extra, position: { ...pos, sideToMove: opponent(human) }, reachable, phase: 'opponent', selected: null, attackers: [], marked: [], coverage: null, message: texts.opponentThinking, log, turnNumber: state.turnNumber + 1 };
  }
  return {
    ...state,
    ...extra,
    position: pos,
    reachable,
    phase: mark ? 'mark' : 'move',
    selected: null,
    attackers: [],
    marked: [],
    coverage: null,
    message: mark ? markMessage(state.settings.assist, reachable.length) : texts.yourMove,
    turnNumber: state.turnNumber + 1,
  };
}

export function markMessage(assist: AssistLevel, count: number): string {
  if (assist === 1) return `${count > 0 ? texts.markHintOne : texts.markHintNone} ${texts.markPrompt}`;
  if (assist === 2) return `${texts.markHintCount(count)} ${texts.markPrompt}`;
  return texts.markPrompt;
}

export function newGame(settings: Settings): GameState {
  const base: GameState = {
    settings,
    position: initialPosition(),
    phase: 'move',
    selected: null,
    attackers: [],
    marked: [],
    reachable: [],
    lastMove: null,
    message: '',
    log: [],
    winner: null,
    victory: null,
    turnNumber: 0,
    coverage: null,
  };
  if (settings.humanSide === 'white') return startHumanTurn(base, base.position);
  return { ...base, phase: 'opponent', message: texts.opponentThinking };
}

export function legalTargets(state: GameState): Set<number> {
  const out = new Set<number>();
  if (state.phase !== 'move' || !state.selected) return out;
  const piece = pieceById(state.position, state.selected);
  if (!piece) return out;
  for (const m of legalMovesOf(state.position, piece)) out.add(squareIndex(state.position.rules, m.to));
  return out;
}

function captureText(c: Capture, pos: Position, own: boolean): string {
  const target = pieceById(pos, c.target);
  const value = c.component ?? target?.value ?? 0;
  if (own) return c.component === undefined ? texts.captured(c.method, value) : texts.capturedComponent(c.method, value);
  return texts.opponentCaptured(c.method, value);
}

function tapMove(state: GameState, square: Square): GameState {
  const pos = state.position;
  const human = state.settings.humanSide;
  const piece = pieceAt(pos, square);
  if (state.selected) {
    const sel = pieceById(pos, state.selected)!;
    const move = legalMovesOf(pos, sel).find((m) => m.to.file === square.file && m.to.rank === square.rank);
    if (move) {
      const next = applyMove(pos, move);
      return {
        ...state,
        position: next,
        lastMove: move,
        selected: null,
        attackers: [],
        phase: 'capture',
        message: texts.capturePrompt,
        log: [...state.log, `${texts.sideNameShort(human)} ${sel.value} ${squareName(move.from)}–${squareName(move.to)}`],
      };
    }
  }
  if (piece && piece.side === human) {
    const selected = state.selected === piece.id ? null : piece.id;
    return { ...state, selected, message: selected ? texts.chooseTarget : texts.yourMove };
  }
  return state;
}

function tapCapture(state: GameState, square: Square): GameState {
  const pos = state.position;
  const human = state.settings.humanSide;
  const piece = pieceAt(pos, square);
  if (!piece) return state;
  if (piece.side === human) {
    const attackers = state.attackers.includes(piece.id) ? state.attackers.filter((id) => id !== piece.id) : [...state.attackers, piece.id];
    return { ...state, attackers };
  }
  if (state.attackers.length === 0) return { ...state, message: texts.chooseAttacker };
  const verdict = explainCapture(pos, human, { by: state.attackers, target: piece.id });
  if (verdict.holds && verdict.primary.capture) {
    const cap = verdict.primary.capture;
    const message = captureText(cap, pos, true);
    return { ...state, position: applyCapture(pos, cap), attackers: [], message, log: [...state.log, message] };
  }
  return { ...state, attackers: [], message: describeExplanation(pos, verdict.primary) };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'new_game':
      return newGame(action.settings);
    case 'tap': {
      if (state.phase === 'mark') {
        const idx = squareIndex(state.position.rules, action.square);
        const marked = state.marked.includes(idx) ? state.marked.filter((i) => i !== idx) : [...state.marked, idx];
        return { ...state, marked };
      }
      if (state.phase === 'move') return tapMove(state, action.square);
      if (state.phase === 'capture') return tapCapture(state, action.square);
      return state;
    }
    case 'confirm_mark': {
      if (state.phase !== 'mark') return state;
      const coverage = coverageOf(state.marked, actualSquares(state.position, state.reachable));
      const note = coverage === null ? texts.coverageNone : texts.coverageResult(Math.round(coverage * 100));
      return { ...state, phase: 'move', coverage, message: `${note} ${texts.yourMove}` };
    }
    case 'end_turn': {
      if (state.phase !== 'capture') return state;
      const human = state.settings.humanSide;
      const victory = victoryOf(state.position, human);
      if (victory) {
        const message = texts.won(human, victory.victory, victory.kinds, victory.values);
        return { ...state, phase: 'over', winner: human, victory, message, log: [...state.log, message], selected: null, attackers: [] };
      }
      const position: Position = { ...state.position, sideToMove: opponent(human) };
      return { ...state, position, phase: 'opponent', selected: null, attackers: [], message: texts.opponentThinking };
    }
    case 'opponent_played': {
      const { turn, result } = action;
      const enemy = opponent(state.settings.humanSide);
      const mover = pieceById(state.position, turn.move.pieceId);
      const lines = [texts.opponentMoved(mover?.value ?? 0, squareName(turn.move.from), squareName(turn.move.to))];
      for (const c of turn.captures) lines.push(captureText(c, applyMove(state.position, turn.move), false));
      if (result.victory) {
        const message = texts.won(enemy, result.victory.victory, result.victory.kinds, result.victory.values);
        return { ...state, position: result.position, lastMove: turn.move, phase: 'over', winner: enemy, victory: result.victory, message, log: [...state.log, ...lines, message] };
      }
      return startHumanTurn(state, result.position, { lastMove: turn.move, log: [...state.log, ...lines] });
    }
    case 'opponent_passed':
      return startHumanTurn(state, state.position, { log: [...state.log, texts.opponentCannotMove] });
  }
}

/** Highlights for the board, derived from the state. */
export function harmonySquares(state: GameState): Set<number> {
  const out = new Set<number>();
  if (state.settings.assist < 3 || state.phase === 'opponent' || state.phase === 'over') return out;
  for (const h of state.reachable) for (const sq of h.squares) out.add(squareIndex(state.position.rules, sq));
  return out;
}

export function availableCaptureTargets(state: GameState): Set<number> {
  const out = new Set<number>();
  if (state.phase !== 'capture') return out;
  for (const c of findCaptures(state.position, state.settings.humanSide)) {
    const t = pieceById(state.position, c.target);
    if (t) out.add(squareIndex(state.position.rules, t.square));
  }
  return out;
}

export { isEnemyHalf };
