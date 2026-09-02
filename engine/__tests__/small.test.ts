import { describe, expect, it } from 'vitest';
import { initialPosition, place, piecesOf } from '../board';
import { findCaptures } from '../capture';
import { playTurn, autoTurn } from '../game';
import { findHarmonies, harmonyKinds, reachableHarmonies } from '../harmony';
import { legalMoves } from '../moves';
import { mebben } from '../rules/mebben';
import { small } from '../rules/small';
import { chooseMove, STRENGTH_PRESETS } from '../search';

describe('the small board', () => {
  it('sets up four stones a side on 4 x 8, no pyramid, and both sides can move', () => {
    const pos = initialPosition(small);
    expect(pos.rules.board).toEqual({ files: 4, ranks: 8 });
    expect(piecesOf(pos, 'white').map((p) => p.value).sort((a, b) => a - b)).toEqual([2, 4, 6, 8]);
    expect(piecesOf(pos, 'black').map((p) => p.value).sort((a, b) => a - b)).toEqual([3, 6, 9, 12]);
    expect(pos.pieces.every((p) => p.shape !== 'pyramid')).toBe(true);
    expect(legalMoves(pos).length).toBeGreaterThan(0);
    expect(legalMoves({ ...pos, sideToMove: 'black' }).length).toBeGreaterThan(0);
  });

  it('gives both sides three harmonies among their values', () => {
    const count = (vals: number[]) => {
      let n = 0;
      for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) for (let k = j + 1; k < vals.length; k++) n += harmonyKinds(vals[i]!, vals[j]!, vals[k]!).length;
      return n;
    };
    expect(count([2, 4, 6, 8])).toBe(3);
    expect(count([3, 6, 9, 12])).toBe(3);
  });

  it('only the meeting captures; Mebben keeps all four', () => {
    // white 4 could step onto black 4? black has no 4: use a black 6 next to white 6 (triangle, diagonal 2)
    const pos = place(
      [
        { id: 'w6', side: 'white', shape: 'triangle', value: 6, at: 'a5' },
        { id: 'b6', side: 'black', shape: 'round', value: 6, at: 'c7' },
        { id: 'w2', side: 'white', shape: 'round', value: 2, at: 'd5' },
        { id: 'w4', side: 'white', shape: 'round', value: 4, at: 'd6' },
        { id: 'b12', side: 'black', shape: 'square', value: 12, at: 'a8' },
      ],
      'white',
      small,
    );
    const caps = findCaptures(pos, 'white');
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((c) => c.method === 'meeting')).toBe(true);
    expect(caps.some((c) => c.target === 'b6')).toBe(true);
    expect(new Set(findCaptures(initialPosition(mebben), 'white').map((c) => c.method)).size).toBeLessThanOrEqual(4);
  });

  it('wins with a harmony of three in the enemy half', () => {
    const pos = place(
      [
        { id: 'w2', side: 'white', shape: 'round', value: 2, at: 'a6' },
        { id: 'w4', side: 'white', shape: 'round', value: 4, at: 'b6' },
        { id: 'w6', side: 'white', shape: 'triangle', value: 6, at: 'a4' },
        { id: 'b12', side: 'black', shape: 'square', value: 12, at: 'a8' },
      ],
      'white',
      small,
    );
    const move = legalMoves(pos).find((m) => m.pieceId === 'w6' && m.to.file === 2 && m.to.rank === 5);
    expect(move).toBeDefined();
    expect(findHarmonies(pos, 'white')).toEqual([]);
    expect(reachableHarmonies(pos, 'white').length).toBeGreaterThan(0);
    const result = playTurn(pos, autoTurn(pos, move!));
    expect(result.winner).toBe('white');
    expect(result.victory?.values).toEqual([2, 4, 6]);
  });

  it('the opponent finds a move quickly from the start', () => {
    const pos = initialPosition(small);
    const t0 = Date.now();
    const r = chooseMove(pos, { ...STRENGTH_PRESETS.apprentice, seed: 1 });
    expect(r).not.toBeNull();
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('rating a move on the small board', () => {
  it('calls the winning move strong and a pointless one weaker than the best', async () => {
    const { rateMove } = await import('../search');
    const pos = place(
      [
        { id: 'w2', side: 'white', shape: 'round', value: 2, at: 'a6' },
        { id: 'w4', side: 'white', shape: 'round', value: 4, at: 'b6' },
        { id: 'w6', side: 'white', shape: 'triangle', value: 6, at: 'a4' },
        { id: 'w8', side: 'white', shape: 'square', value: 8, at: 'd1' },
        { id: 'b12', side: 'black', shape: 'square', value: 12, at: 'a8' },
        { id: 'b3', side: 'black', shape: 'round', value: 3, at: 'd8' },
      ],
      'white',
      small,
    );
    const win = legalMoves(pos).find((m) => m.pieceId === 'w6' && m.to.file === 2 && m.to.rank === 5)!;
    const idle = legalMoves(pos).find((m) => m.pieceId === 'w8')!;
    expect(rateMove(pos, win, STRENGTH_PRESETS.apprentice).strong).toBe(true);
    const r = rateMove(pos, idle, STRENGTH_PRESETS.apprentice);
    expect(r.score).toBeLessThan(r.bestScore);
    expect(r.strong).toBe(false);
  });
});
