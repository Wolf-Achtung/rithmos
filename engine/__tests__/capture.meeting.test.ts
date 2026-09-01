import { describe, expect, it } from 'vitest';
import { place } from '../board';
import { applyCapture, meetingCaptures } from '../capture';

describe('meeting (Begegnung)', () => {
  it('captures an enemy of equal value one regular move away', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 4, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 4, at: 'd9' },
    ]);
    const caps = meetingCaptures(pos, 'white');
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({ method: 'meeting', by: ['a'], target: 'b', detail: { value: 4 } });
    // the capturer stays, the target disappears
    const after = applyCapture(pos, caps[0]!);
    expect(after.pieces.map((p) => p.id)).toEqual(['a']);
    expect(after.pieces[0]!.square).toEqual({ file: 3, rank: 7 });
  });

  it('needs equal values', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 4, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
    ]);
    expect(meetingCaptures(pos, 'white')).toEqual([]);
  });

  it('needs the target within the regular move (distance and direction)', () => {
    const tooFar = place([
      { id: 'a', side: 'white', shape: 'round', value: 9, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 9, at: 'd10' },
    ]);
    expect(meetingCaptures(tooFar, 'white')).toEqual([]);
    const wrongDirection = place([
      { id: 'a', side: 'white', shape: 'round', value: 9, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 9, at: 'e9' },
    ]);
    expect(meetingCaptures(wrongDirection, 'white')).toEqual([]);
  });

  it('is blocked by an intermediate piece', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'square', value: 25, at: 'd8' },
      { id: 'x', side: 'white', shape: 'round', value: 2, at: 'd9' },
      { id: 'b', side: 'black', shape: 'round', value: 25, at: 'd11' },
    ]);
    expect(meetingCaptures(pos, 'white')).toEqual([]);
  });

  it('works for both sides and any shape', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'square', value: 25, at: 'd8' },
      { id: 'b', side: 'black', shape: 'triangle', value: 25, at: 'g11' },
    ]);
    expect(meetingCaptures(pos, 'white').map((c) => c.target)).toEqual(['b']);
    // the triangle moves 2 diagonally, the square is 3 away: black cannot meet
    expect(meetingCaptures(pos, 'black')).toEqual([]);
  });

  it('takes a pyramid component on its own value, and the whole pyramid on the sum', () => {
    const pos = place([
      { id: 'a', side: 'black', shape: 'round', value: 9, at: 'e8' },
      { id: 's', side: 'black', shape: 'square', value: 70, at: 'd11' },
      {
        id: 'p',
        side: 'white',
        shape: 'pyramid',
        components: [
          { value: 36, shape: 'square' },
          { value: 25, shape: 'square' },
          { value: 9, shape: 'triangle' },
        ],
        at: 'd8',
      },
    ]);
    const caps = meetingCaptures(pos, 'black');
    expect(caps.map((c) => [c.by[0], c.component])).toEqual([
      ['a', 9],
      ['s', undefined],
    ]);
    const after = applyCapture(pos, caps[0]!);
    const p = after.pieces.find((x) => x.id === 'p')!;
    expect(p.value).toBe(61);
    expect(p.components!.map((c) => c.value)).toEqual([36, 25]);
    const gone = applyCapture(pos, caps[1]!);
    expect(gone.pieces.find((x) => x.id === 'p')).toBeUndefined();
  });
});
