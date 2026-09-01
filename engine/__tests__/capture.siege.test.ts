import { describe, expect, it } from 'vitest';
import { place } from '../board';
import { blockingPieces, siegeCaptures } from '../capture';

describe('siege (Belagerung)', () => {
  it('captures a piece in the corner that cannot move', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'w1', side: 'white', shape: 'round', value: 2, at: 'a2' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'b1' },
    ]);
    const caps = siegeCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({ method: 'siege', target: 'b' });
    expect([...caps[0]!.by].sort()).toEqual(['w1', 'w2']);
  });

  it('a triangle in the open is not besieged by orthogonal neighbours', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'triangle', value: 12, at: 'd8' },
      { id: 'w1', side: 'white', shape: 'round', value: 2, at: 'd9' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'd7' },
      { id: 'w3', side: 'white', shape: 'round', value: 6, at: 'c8' },
      { id: 'w4', side: 'white', shape: 'round', value: 8, at: 'e8' },
    ]);
    expect(siegeCaptures(pos, 'white')).toEqual([]);
  });

  it('a triangle is besieged on its four diagonal paths', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'triangle', value: 12, at: 'd8' },
      { id: 'w1', side: 'white', shape: 'round', value: 2, at: 'c9' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'e9' },
      { id: 'w3', side: 'white', shape: 'round', value: 6, at: 'c7' },
      { id: 'w4', side: 'white', shape: 'square', value: 15, at: 'f6' },
    ]);
    const caps = siegeCaptures(pos, 'white');
    expect(caps.map((c) => c.target)).toEqual(['b']);
    expect([...caps[0]!.by].sort()).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(blockingPieces(pos, pos.pieces[0]!).map((p) => p.id).sort()).toEqual(['w1', 'w2', 'w3', 'w4']);
  });

  it('is not a siege when a single own piece can free the target', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'friend', side: 'black', shape: 'round', value: 5, at: 'a2' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'b1' },
    ]);
    expect(siegeCaptures(pos, 'white')).toEqual([]);
  });

  it('is not a siege when only edges and own pieces block, but the outer ring is', () => {
    const pos = place([
      { id: 'a1', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'a2', side: 'black', shape: 'round', value: 5, at: 'a2' },
      { id: 'b1', side: 'black', shape: 'round', value: 7, at: 'b1' },
      { id: 'b2', side: 'black', shape: 'round', value: 9, at: 'b2' },
      { id: 'w1', side: 'white', shape: 'round', value: 2, at: 'a3' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'b3' },
      { id: 'w3', side: 'white', shape: 'round', value: 6, at: 'c1' },
      { id: 'w4', side: 'white', shape: 'round', value: 8, at: 'c2' },
    ]);
    const targets = siegeCaptures(pos, 'white')
      .map((c) => c.target)
      .sort();
    expect(targets).toEqual(['a2', 'b1', 'b2']);
  });

  it('a friendly piece that cannot reach the blockers does not free the target', () => {
    // a1 only moves to a2 or b1, both white. The black square at e2 has moves, none of them frees a1.
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'sq', side: 'black', shape: 'square', value: 28, at: 'e2' },
      { id: 'w1', side: 'white', shape: 'round', value: 2, at: 'a2' },
      { id: 'w2', side: 'white', shape: 'round', value: 4, at: 'b1' },
    ]);
    expect(siegeCaptures(pos, 'white').map((c) => c.target)).toEqual(['b']);
  });
});
