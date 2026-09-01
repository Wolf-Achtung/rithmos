import { describe, expect, it } from 'vitest';
import { place, squareName } from '../board';
import { midgamePosition } from '../fixtures/midgame';
import { playTurn, turnToString } from '../game';
import { chooseMove, deriveIntent, evaluate, STRENGTH_PRESETS } from '../search';
import { isLegalMove } from '../moves';

describe('chooseMove', () => {
  it('completes a harmony when it can, and says so', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'e11' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    const r = chooseMove(pos, { depth: 1, breadth: 8, noise: 0 })!;
    expect(turnToString(r.turn)).toBe('c e11-e10');
    expect(r.intent).toMatchObject({ kind: 'complete_harmony', harmony: { kinds: ['arithmetic'], values: [2, 4, 6], region: 'left' } });
    expect(r.score).toBeGreaterThan(50_000);
  });

  it('takes a capture and reports it', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd7' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
      { id: 'z', side: 'black', shape: 'square', value: 361, at: 'a16' },
    ]);
    const r = chooseMove(pos, { depth: 1, breadth: 8, noise: 0 })!;
    expect(r.intent.kind).toBe('capture');
    expect(r.turn.captures.map((c) => c.target)).toEqual(['b']);
  });

  it('moves a threatened piece out of danger', () => {
    const pos = place([
      { id: 'v', side: 'white', shape: 'round', value: 5, at: 'd5' },
      { id: 'att', side: 'black', shape: 'round', value: 10, at: 'd8' },
      { id: 'z', side: 'black', shape: 'square', value: 361, at: 'a16' },
    ]);
    const r = chooseMove(pos, { depth: 2, breadth: 8, noise: 0 })!;
    expect(r.turn.move.pieceId).toBe('v');
    expect(['c5', 'e5', 'd6']).toContain(squareName(r.turn.move.to));
    expect(r.intent.kind).toBe('escape');
  });

  it('blocks the opponent harmony one move before completion', () => {
    const pos = place([
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'b2' },
      { id: 'y', side: 'black', shape: 'round', value: 6, at: 'c2' },
      { id: 'z', side: 'black', shape: 'triangle', value: 12, at: 'f4' },
      { id: 'w', side: 'white', shape: 'round', value: 8, at: 'e2' },
      { id: 'far', side: 'white', shape: 'square', value: 289, at: 'h8' },
    ]);
    const r = chooseMove(pos, { depth: 2, breadth: 10, noise: 0 })!;
    expect(turnToString(r.turn)).toBe('w e2-d2');
    expect(r.intent).toMatchObject({ kind: 'block', opponentPieces: ['x', 'y', 'z'] });
  });

  it('is deterministic for a seed, and legal on the middle-game fixture', () => {
    const pos = midgamePosition();
    const a = chooseMove(pos, { ...STRENGTH_PRESETS.novice, seed: 7 })!;
    const b = chooseMove(pos, { ...STRENGTH_PRESETS.novice, seed: 7 })!;
    expect(turnToString(a.turn)).toBe(turnToString(b.turn));
    expect(isLegalMove(pos, a.turn.move)).toBe(true);
    expect(() => playTurn(pos, a.turn)).not.toThrow();
    const c = chooseMove(pos, STRENGTH_PRESETS.apprentice)!;
    expect(isLegalMove(pos, c.turn.move)).toBe(true);
    expect(c.line.length).toBeGreaterThanOrEqual(1);
    expect(c.nodes).toBeGreaterThan(50);
  });

  it('white completes 2/4/6 on the fixture, black would too', () => {
    const pos = midgamePosition();
    const r = chooseMove(pos, { depth: 1, breadth: 8, noise: 0 })!;
    expect(r.intent).toMatchObject({ kind: 'complete_harmony', harmony: { values: [2, 4, 6], arrangement: 'angle' } });
    const b = chooseMove({ ...pos, sideToMove: 'black' }, { depth: 1, breadth: 8, noise: 0 })!;
    expect(b.intent).toMatchObject({ kind: 'complete_harmony', harmony: { values: [5, 7, 9] } });
  });

  it('builds toward a harmony two moves away and names the pieces', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'e12' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    const r = chooseMove(pos, { depth: 1, breadth: 8, noise: 0 })!;
    // three moves tie: c e12-e11 (line), c e12-d12 and a a10-a11 (angles); any of them is a build toward 2/4/6
    expect(['c e12-e11', 'c e12-d12', 'a a10-a11']).toContain(turnToString(r.turn));
    expect(r.intent).toMatchObject({ kind: 'build_harmony', movesAway: 1, harmony: { values: [2, 4, 6], region: 'left' }, threatenedBy: [] });
    if (r.intent.kind === 'build_harmony') expect([...r.intent.harmony.pieces].sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns null without legal moves', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'w1', side: 'white', shape: 'round', value: 2, at: 'a2' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'b1' },
    ], 'black');
    expect(chooseMove(pos, { depth: 1, breadth: 4, noise: 0 })).toBeNull();
  });

  it('evaluate is antisymmetric', () => {
    const pos = midgamePosition();
    expect(evaluate(pos, 'white')).toBe(-evaluate(pos, 'black'));
  });

  it('deriveIntent falls back to develop', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'square', value: 289, at: 'a1' },
      { id: 'z', side: 'black', shape: 'square', value: 361, at: 'h16' },
    ]);
    const intent = deriveIntent(pos, { move: { pieceId: 'a', from: { file: 0, rank: 0 }, to: { file: 0, rank: 3 } }, captures: [] });
    expect(intent).toEqual({ kind: 'develop', piece: 'a', intoEnemyHalf: false });
  });
});
