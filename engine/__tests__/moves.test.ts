import { describe, expect, it } from 'vitest';
import { initialPosition, place, squareName } from '../board';
import { applyMove, canReach, isLegalMove, legalMoves, legalMovesOf, reachableSquares } from '../moves';

const names = (sqs: { square: { file: number; rank: number } }[]) => sqs.map((r) => squareName(r.square)).sort();

describe('the counting trap: Mebben counts start and target square', () => {
  it('a round moves ONE square straight, never two and never diagonally', () => {
    const pos = place([{ id: 'r', side: 'white', shape: 'round', value: 2, at: 'd8' }]);
    const reach = reachableSquares(pos, pos.pieces[0]!);
    expect(names(reach)).toEqual(['c8', 'd7', 'd9', 'e8']);
  });

  it('a triangle moves TWO squares, diagonally only', () => {
    const pos = place([{ id: 't', side: 'white', shape: 'triangle', value: 6, at: 'd8' }]);
    const reach = reachableSquares(pos, pos.pieces[0]!);
    expect(names(reach)).toEqual(['b10', 'b6', 'f10', 'f6']);
  });

  it('a square moves THREE squares in every direction', () => {
    const pos = place([{ id: 's', side: 'white', shape: 'square', value: 15, at: 'd8' }]);
    const reach = reachableSquares(pos, pos.pieces[0]!);
    expect(names(reach)).toEqual(['a11', 'a5', 'a8', 'd11', 'd5', 'g11', 'g5', 'g8']);
  });
});

describe('blocking and board edge', () => {
  it('a triangle cannot jump over a piece on the intermediate square', () => {
    const pos = place([
      { id: 't', side: 'white', shape: 'triangle', value: 6, at: 'd8' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'e9' },
    ]);
    const reach = reachableSquares(pos, pos.pieces[0]!);
    expect(names(reach)).toEqual(['b10', 'b6', 'f6']);
  });

  it('a square stops at the edge', () => {
    const pos = place([{ id: 's', side: 'white', shape: 'square', value: 15, at: 'a1' }]);
    expect(names(reachableSquares(pos, pos.pieces[0]!))).toEqual(['a4', 'd1', 'd4']);
  });

  it('the target square must be empty for a regular move', () => {
    const pos = place([
      { id: 'r', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'd9' },
      { id: 'y', side: 'white', shape: 'round', value: 4, at: 'c8' },
    ]);
    const r = pos.pieces[0]!;
    expect(names(reachableSquares(pos, r))).toEqual(['d7', 'e8']);
    // For capture threats the enemy square may be the target, an own piece never.
    expect(names(reachableSquares(pos, r, { allowEnemyTarget: true }))).toEqual(['d7', 'd9', 'e8']);
    expect(canReach(pos, r, { file: 3, rank: 8 }, { allowEnemyTarget: true })).toBe('round');
  });
});

describe('pyramid', () => {
  it('moves as any of its live component shapes', () => {
    const pos = place([
      {
        id: 'p',
        side: 'white',
        shape: 'pyramid',
        components: [
          { value: 36, shape: 'square' },
          { value: 16, shape: 'triangle' },
          { value: 4, shape: 'round' },
        ],
        at: 'd8',
      },
    ]);
    const moves = legalMovesOf(pos, pos.pieces[0]!);
    const asRound = moves.filter((m) => m.as === 'round');
    const asTriangle = moves.filter((m) => m.as === 'triangle');
    const asSquare = moves.filter((m) => m.as === 'square');
    expect(asRound).toHaveLength(4);
    expect(asTriangle).toHaveLength(4);
    expect(asSquare).toHaveLength(8);
  });

  it('loses a movement shape with its last component of that shape', () => {
    const pos = place([
      { id: 'p', side: 'white', shape: 'pyramid', components: [{ value: 36, shape: 'square' }], at: 'd8' },
    ]);
    const moves = legalMovesOf(pos, pos.pieces[0]!);
    expect(moves.every((m) => m.as === 'square')).toBe(true);
    expect(moves).toHaveLength(8);
  });
});

describe('legalMoves and applyMove', () => {
  it('validates side, origin and reach', () => {
    const pos = place([
      { id: 'r', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
    ]);
    const from = { file: 3, rank: 7 };
    expect(isLegalMove(pos, { pieceId: 'r', from, to: { file: 3, rank: 8 } })).toBe(true);
    expect(isLegalMove(pos, { pieceId: 'r', from, to: { file: 3, rank: 9 } })).toBe(false);
    expect(isLegalMove(pos, { pieceId: 'r', from: { file: 0, rank: 0 }, to: { file: 3, rank: 8 } })).toBe(false);
    expect(isLegalMove(pos, { pieceId: 'b', from: { file: 0, rank: 0 }, to: { file: 0, rank: 1 } })).toBe(false);
    expect(isLegalMove(pos, { pieceId: 'b', from: { file: 0, rank: 0 }, to: { file: 0, rank: 1 } }, 'black')).toBe(true);
  });

  it('applyMove relocates the piece and keeps everything else', () => {
    const pos = place([
      { id: 'r', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
    ]);
    const next = applyMove(pos, { pieceId: 'r', from: { file: 3, rank: 7 }, to: { file: 3, rank: 8 } });
    expect(squareName(next.pieces.find((p) => p.id === 'r')!.square)).toBe('d9');
    expect(squareName(next.pieces.find((p) => p.id === 'b')!.square)).toBe('a1');
    expect(next.sideToMove).toBe('white');
    // the original is untouched
    expect(squareName(pos.pieces.find((p) => p.id === 'r')!.square)).toBe('d8');
  });
});

describe('regression corpus', () => {
  it('initial position: fixed number of legal moves for white', () => {
    const pos = initialPosition();
    const moves = legalMoves(pos);
    // Recorded once from the provisional layout. A change here means the setup or the move rules changed.
    expect(moves).toHaveLength(8);
    expect(legalMoves(pos, 'black')).toHaveLength(8);
  });
});
