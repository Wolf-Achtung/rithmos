import { describe, expect, it } from 'vitest';
import { midgamePosition } from '../fixtures/midgame';
import { findHarmonies, reachableHarmonies } from '../harmony';
import { legalMoves } from '../moves';
import { findCaptures } from '../capture';

describe('middle-game fixture', () => {
  const pos = midgamePosition();
  it('has 20 pieces per side and no standing harmony', () => {
    expect(pos.pieces.filter((p) => p.side === 'white')).toHaveLength(20);
    expect(pos.pieces.filter((p) => p.side === 'black')).toHaveLength(20);
    expect(findHarmonies(pos, 'white')).toEqual([]);
    expect(findHarmonies(pos, 'black')).toEqual([]);
  });
  it('regression corpus: move, capture and reachable-harmony counts', () => {
    const w = legalMoves(pos, 'white').length;
    const b = legalMoves(pos, 'black').length;
    const cw = findCaptures(pos, 'white').length;
    const cb = findCaptures(pos, 'black').length;
    const hw = reachableHarmonies(pos, 'white', 1).length;
    const hb = reachableHarmonies(pos, 'black', 1).length;
    expect({ w, b, cw, cb, hw, hb }).toEqual({ w: 54, b: 45, cw: 2, cb: 1, hw: 1, hb: 1 });
  });
});
