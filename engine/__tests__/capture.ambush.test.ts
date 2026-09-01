import { describe, expect, it } from 'vitest';
import { place } from '../board';
import { ambushCaptures } from '../capture';

describe('ambush (Hinterhalt)', () => {
  it('captures on the SUM of two pieces that can both reach the target', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'triangle', value: 3, at: 'b11' },
    ]);
    const caps = ambushCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({
      method: 'ambush',
      target: 'b',
      detail: { operation: 'sum', values: [2, 3], result: 5 },
    });
    expect([...caps[0]!.by].sort()).toEqual(['a1', 'a2']);
  });

  it('captures on the DIFFERENCE of two pieces', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 9, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'round', value: 4, at: 'c9' },
    ]);
    const caps = ambushCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]!.detail).toMatchObject({ operation: 'difference', result: 5 });
  });

  it('needs at least two attackers that can reach the square', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 2, at: 'd8' },
      // 3 cannot reach d9: a round moves one square straight
      { id: 'a2', side: 'white', shape: 'round', value: 3, at: 'c10' },
    ]);
    expect(ambushCaptures(pos, 'white')).toEqual([]);
  });

  it('fails when neither sum nor difference matches', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 7, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'round', value: 4, at: 'c9' },
    ]);
    expect(ambushCaptures(pos, 'white')).toEqual([]);
  });

  it('two equal pieces ambush on their sum, never on the zero difference', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 8, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 4, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'round', value: 4, at: 'c9' },
    ]);
    const caps = ambushCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]!.detail).toMatchObject({ operation: 'sum', result: 8 });
  });

  it('three pieces ambush on their sum', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 9, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'round', value: 3, at: 'c9' },
      { id: 'a3', side: 'white', shape: 'round', value: 4, at: 'e9' },
    ]);
    const caps = ambushCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]!.by).toHaveLength(3);
    expect(caps[0]!.detail).toMatchObject({ operation: 'sum', result: 9 });
  });

  it('the attackers must be adjacent by their regular move, not by any path', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
      // a triangle moves diagonally two squares: e10 is one diagonal step, not a legal reach
      { id: 'a1', side: 'white', shape: 'triangle', value: 2, at: 'e10' },
      { id: 'a2', side: 'white', shape: 'round', value: 3, at: 'c9' },
    ]);
    expect(ambushCaptures(pos, 'white')).toEqual([]);
  });

  it('can take a pyramid component', () => {
    const pos = place([
      {
        id: 'p',
        side: 'black',
        shape: 'pyramid',
        components: [
          { value: 64, shape: 'square' },
          { value: 16, shape: 'round' },
        ],
        at: 'd9',
      },
      { id: 'a1', side: 'white', shape: 'round', value: 6, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'round', value: 10, at: 'c9' },
    ]);
    const caps = ambushCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({ target: 'p', component: 16 });
  });
});
