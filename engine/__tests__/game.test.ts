import { describe, expect, it } from 'vitest';
import { parseSquare, place } from '../board';
import { autoTurn, playTurn, turnToString } from '../game';

describe('playTurn', () => {
  it('moves, captures, flips the side', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd7' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    const turn = autoTurn(pos, { pieceId: 'a', from: parseSquare('d7'), to: parseSquare('d8') });
    expect(turn.captures.map((c) => c.method)).toEqual(['assault']);
    const r = playTurn(pos, turn);
    expect(r.position.pieces.map((p) => p.id)).toEqual(['a']);
    expect(r.position.sideToMove).toBe('black');
    expect(r.winner).toBeNull();
    expect(turnToString(turn)).toBe('a d7-d8 (assault xb)');
  });

  it('rejects a capture that does not hold', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd7' },
      { id: 'b', side: 'black', shape: 'round', value: 11, at: 'd11' },
    ]);
    const move = { pieceId: 'a', from: parseSquare('d7'), to: parseSquare('d8') };
    expect(() =>
      playTurn(pos, { move, captures: [{ method: 'assault', by: ['a'], target: 'b', detail: { method: 'assault', value: 5, distance: 2, operation: 'times', result: 10 } }] }),
    ).toThrow(/does not hold/);
    expect(() => playTurn(pos, { move: { ...move, to: parseSquare('d9') }, captures: [] })).toThrow(/illegal move/);
  });

  it('detects the victory of the mover', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd11' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    const r = playTurn(pos, { move: { pieceId: 'c', from: parseSquare('d11'), to: parseSquare('d10') }, captures: [] });
    expect(r.winner).toBe('white');
    expect(r.victory?.values).toEqual([2, 4, 6]);
  });

  it('greedy captures take everything available, one after another', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 4, at: 'd7' },
      { id: 'x', side: 'black', shape: 'round', value: 4, at: 'd9' },
      { id: 'y', side: 'black', shape: 'round', value: 4, at: 'e8' },
    ]);
    const turn = autoTurn(pos, { pieceId: 'a', from: parseSquare('d7'), to: parseSquare('d8') });
    expect(turn.captures.map((c) => c.target).sort()).toEqual(['x', 'y']);
    const r = playTurn(pos, turn);
    expect(r.position.pieces).toHaveLength(1);
  });
});
