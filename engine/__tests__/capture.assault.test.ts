import { describe, expect, it } from 'vitest';
import { place } from '../board';
import { assaultCaptures, findCaptures } from '../capture';

describe('assault (Angriff)', () => {
  it('captures when value TIMES the empty squares between equals the target', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    const caps = assaultCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({
      method: 'assault',
      by: ['a'],
      target: 'b',
      detail: { value: 5, distance: 2, operation: 'times', result: 10 },
    });
  });

  it('captures when value DIVIDED by the empty squares between equals the target', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 20, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    const caps = assaultCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]!.detail).toMatchObject({ value: 20, distance: 2, operation: 'divided', result: 10 });
  });

  it('zero squares between is never an assault', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
    ]);
    expect(assaultCaptures(pos, 'white')).toEqual([]);
    // adjacent equal values are a meeting, not an assault
    expect(findCaptures(pos, 'white').map((c) => c.method)).toEqual(['meeting']);
  });

  it('a division that does not come out even is no capture', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 15, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 7, at: 'd11' },
    ]);
    expect(assaultCaptures(pos, 'white')).toEqual([]);
  });

  it('the example from the project description: 5 x 2 = 10, target 15, no capture', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'square', value: 15, at: 'd11' },
    ]);
    expect(assaultCaptures(pos, 'white')).toEqual([]);
    // with one square less it would fit? no: 5 x 1 = 5. With three squares: 5 x 3 = 15.
    const fits = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'square', value: 15, at: 'd12' },
    ]);
    expect(assaultCaptures(fits, 'white')).toHaveLength(1);
  });

  it('only along the regular direction of the attacker', () => {
    // a round never assaults diagonally
    const round = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'g11' },
    ]);
    expect(assaultCaptures(round, 'white')).toEqual([]);
    // a triangle does, and the distance is not limited to its move length
    const triangle = place([
      { id: 'a', side: 'white', shape: 'triangle', value: 6, at: 'a1' },
      { id: 'b', side: 'black', shape: 'round', value: 24, at: 'f6' },
    ]);
    const caps = assaultCaptures(triangle, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]!.detail).toMatchObject({ distance: 4, operation: 'times', result: 24 });
  });

  it('is blocked by any piece in between', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'x', side: 'white', shape: 'round', value: 2, at: 'd10' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    expect(assaultCaptures(pos, 'white')).toEqual([]);
  });

  it('can take a pyramid component by division', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'square', value: 45, at: 'd8' },
      {
        id: 'p',
        side: 'black',
        shape: 'pyramid',
        components: [
          { value: 64, shape: 'square' },
          { value: 9, shape: 'round' },
        ],
        at: 'd14',
      },
    ]);
    const caps = assaultCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({ target: 'p', component: 9, detail: { distance: 5, operation: 'divided', result: 9 } });
  });
});
