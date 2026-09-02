import { describe, expect, it } from 'vitest';
import { initialPosition, isEnemyHalf, pieceAt, place, pyramidValue, squareName, parseSquare } from '../board';
import { mebben } from '../rules/mebben';

describe('pyramids', () => {
  it('white pyramid sums to 91 from 36+25+16+9+4+1', () => {
    const c = mebben.setup.white.pyramid!.components.map((x) => x.value);
    expect(c).toEqual([36, 25, 16, 9, 4, 1]);
    expect(pyramidValue(mebben.setup.white.pyramid!.components)).toBe(91);
  });

  it('black pyramid sums to 190 from 64+49+36+25+16', () => {
    const c = mebben.setup.black.pyramid!.components.map((x) => x.value);
    expect(c).toEqual([64, 49, 36, 25, 16]);
    expect(pyramidValue(mebben.setup.black.pyramid!.components)).toBe(190);
  });
});

describe('initial position', () => {
  const pos = initialPosition();

  it('has 24 pieces per side, one pyramid each', () => {
    const white = pos.pieces.filter((p) => p.side === 'white');
    const black = pos.pieces.filter((p) => p.side === 'black');
    expect(white).toHaveLength(24);
    expect(black).toHaveLength(24);
    expect(white.filter((p) => p.shape === 'pyramid').map((p) => p.value)).toEqual([91]);
    expect(black.filter((p) => p.shape === 'pyramid').map((p) => p.value)).toEqual([190]);
  });

  it('carries the classical values built from the base numbers', () => {
    const values = (side: 'white' | 'black', shape: string) =>
      pos.pieces
        .filter((p) => p.side === side && p.shape === shape)
        .map((p) => p.value)
        .sort((a, b) => a - b);
    expect(values('white', 'round')).toEqual([2, 4, 4, 6, 8, 16, 36, 64]);
    expect(values('white', 'triangle')).toEqual([6, 9, 20, 25, 42, 49, 72, 81]);
    expect(values('white', 'square')).toEqual([15, 25, 45, 81, 153, 169, 289]);
    expect(values('black', 'round')).toEqual([3, 5, 7, 9, 9, 25, 49, 81]);
    expect(values('black', 'triangle')).toEqual([12, 16, 30, 36, 56, 64, 90, 100]);
    expect(values('black', 'square')).toEqual([28, 49, 66, 120, 121, 225, 361]);
  });

  it('places every side in its own half, mirrored', () => {
    for (const p of pos.pieces) {
      expect(isEnemyHalf(pos.rules, p.side, p.square)).toBe(false);
    }
    const white = pos.pieces.filter((p) => p.side === 'white');
    for (const w of white) {
      const mirror = pieceAt(pos, { file: w.square.file, rank: 15 - w.square.rank });
      expect(mirror?.side).toBe('black');
      expect(mirror?.shape).toBe(w.shape);
    }
  });

  it('gives unique ids, with a suffix for equal values', () => {
    const ids = pos.pieces.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('Wr4');
    expect(ids).toContain('Wr4_2');
    expect(ids).toContain('Wp91');
    expect(ids).toContain('Bp190');
  });

  it('white moves first', () => {
    expect(pos.sideToMove).toBe('white');
  });
});

describe('square names', () => {
  it('round-trips', () => {
    expect(squareName({ file: 2, rank: 3 })).toBe('c4');
    expect(parseSquare('c4')).toEqual({ file: 2, rank: 3 });
    expect(parseSquare('h16')).toEqual({ file: 7, rank: 15 });
  });
});

describe('place()', () => {
  it('rejects two pieces on one square', () => {
    expect(() =>
      place([
        { side: 'white', shape: 'round', value: 2, at: 'a1' },
        { side: 'black', shape: 'round', value: 3, at: 'a1' },
      ]),
    ).toThrow(/two pieces/);
  });
});
