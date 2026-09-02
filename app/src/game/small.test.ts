import { describe, expect, it } from 'vitest';
import { pieceById } from '../../../engine/board';
import { autoTurn, playTurn } from '../../../engine/game';
import { chooseMove, deriveIntent, STRENGTH_PRESETS } from '../../../engine/search';
import { actualSquares, coverageOf, judge, newSmallGame, reasonsFor, reduceSmall, targetsOf } from './small';
import { mebben } from '../../../engine/rules/mebben';
import type { SmallState } from './small';
import type { Position } from '../../../engine/types';

const byValue = (pos: Position, value: number) => pos.pieces.find((p) => p.side === 'white' && p.value === value)!;

function tapName(state: SmallState, name: string): SmallState {
  const file = 'abcd'.indexOf(name[0]!);
  const rank = Number(name.slice(1)) - 1;
  return reduceSmall(state, { type: 'tap', square: { file, rank } });
}

describe('the small board store', () => {
  it('starts with white to move, selects an own stone, shows its targets', () => {
    let s = newSmallGame('white');
    expect(s.phase).toBe('move');
    s = tapName(s, 'b2'); // white 2, round
    expect(s.selected).not.toBeNull();
    expect(targetsOf(s).size).toBeGreaterThan(0);
    s = tapName(s, 'b2');
    expect(s.selected).toBeNull();
  });

  it('a move asks for a reason, the reason is checked, the turn is played', () => {
    let s = newSmallGame('white');
    s = tapName(s, 'b2');
    s = tapName(s, 'b3'); // round: one step forward
    expect(s.phase).toBe('reason');
    expect(s.pending).not.toBeNull();
    s = reduceSmall(s, { type: 'reason', id: null, strong: true });
    expect(s.phase).toBe('opponent');
    expect(s.verdict).toBe('none');
    expect(byValue(s.position, 2).square).toEqual({ file: 1, rank: 2 });
    expect(s.position.sideToMove).toBe('black');
    // the opponent answers with the engine's own move and intent
    const r = chooseMove(s.position, { ...STRENGTH_PRESETS.novice, seed: 3 })!;
    s = reduceSmall(s, { type: 'opponent_played', turn: r.turn, result: playTurn(s.position, r.turn), intent: deriveIntent(s.position, r.turn) });
    expect(s.phase).toBe('move');
    expect(s.turn).toBe(2);
    expect(s.lastIntent).not.toBeNull();
  });

  it('offers reasons the engine can verify, and the four fields follow strength and truth', () => {
    const s = newSmallGame('white');
    const piece = byValue(s.position, 2);
    const move = { pieceId: piece.id, from: piece.square, to: { file: 1, rank: 2 } };
    const offers = reasonsFor(s.position, move);
    expect(Array.isArray(offers)).toBe(true);
    for (const o of offers) expect(['close', 'build', 'threat', 'escape']).toContain(o.kind);
    expect(judge(true, true)).toBe('understood');
    expect(judge(true, false)).toBe('luck');
    expect(judge(false, true)).toBe('slip');
    expect(judge(false, false)).toBe('misread');
    expect(judge(true, null)).toBe('none');
  });

  it('a full match against the engine ends with a winner within a hundred turns', () => {
    let s = newSmallGame('white');
    for (let i = 0; i < 100 && s.phase !== 'over'; i++) {
      const mover = s.position;
      const r = chooseMove(mover, { ...STRENGTH_PRESETS.novice, seed: i })!;
      if (s.phase === 'move') {
        // the human plays the engine's pick through the store
        const from = pieceById(mover, r.turn.move.pieceId)!.square;
        s = reduceSmall(s, { type: 'tap', square: from });
        s = reduceSmall(s, { type: 'tap', square: r.turn.move.to });
        expect(s.phase).toBe('reason');
        s = reduceSmall(s, { type: 'reason', id: s.reasons[0]?.id ?? null, strong: true });
      } else {
        s = reduceSmall(s, { type: 'opponent_played', turn: r.turn, result: playTurn(mover, autoTurn(mover, r.turn.move)), intent: deriveIntent(mover, r.turn) });
      }
    }
    expect(s.phase).toBe('over');
    expect(s.winner).not.toBeNull();
  });
});

describe('the full board with the coverage step', () => {
  it('marks squares before the move, scores the marking against the engine, then moves', () => {
    let s = newSmallGame('white', mebben, true);
    expect(s.phase).toBe('mark');
    expect(s.position.rules.id).toBe(mebben.id);
    const actual = actualSquares(s.position, s.reachable);
    // toggle one square twice, then mark every actual square
    s = reduceSmall(s, { type: 'tap', square: { file: 0, rank: 0 } });
    s = reduceSmall(s, { type: 'tap', square: { file: 0, rank: 0 } });
    expect(s.marked).toEqual([]);
    for (const idx of actual) s = reduceSmall(s, { type: 'tap', square: { file: idx % 8, rank: Math.floor(idx / 8) } });
    s = reduceSmall(s, { type: 'confirm_mark' });
    expect(s.phase).toBe('move');
    expect(s.coverage).toBe(actual.size === 0 ? null : 1);
    expect(coverageOf([1, 2], new Set([2, 3, 4]))).toBeCloseTo(1 / 3);
    expect(coverageOf([], new Set())).toBeNull();
  });
});
