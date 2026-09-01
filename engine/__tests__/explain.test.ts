import { describe, expect, it } from 'vitest';
import { place } from '../board';
import { describeExplanation, explainCapture } from '../explain';

describe('explainCapture', () => {
  it('meeting: names the value mismatch', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 4, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd9' },
    ]);
    const v = explainCapture(pos, 'white', { by: ['a'], target: 'b', method: 'meeting' });
    expect(v.holds).toBe(false);
    expect(v.primary.failure).toEqual({ code: 'value_mismatch', method: 'meeting', attacker: 4, target: 5 });
    expect(describeExplanation(pos, v.primary)).toBe('Begegnung: dein Stein hat 4, das Ziel hat 5. Begegnung braucht gleiche Werte.');
  });

  it('meeting: names the reach problem', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 5, at: 'd10' },
    ]);
    const v = explainCapture(pos, 'white', { by: ['a'], target: 'b', method: 'meeting' });
    expect(v.primary.failure).toMatchObject({ code: 'not_reachable', piece: 'a', target: 'b' });
    expect(describeExplanation(pos, v.primary)).toContain('könnte im nächsten Zug nicht auf d10 ziehen');
  });

  it('ambush: gives sum and difference against the target', () => {
    const pos = place([
      { id: 'b', side: 'black', shape: 'round', value: 7, at: 'd9' },
      { id: 'a1', side: 'white', shape: 'round', value: 2, at: 'd8' },
      { id: 'a2', side: 'white', shape: 'round', value: 4, at: 'c9' },
    ]);
    const v = explainCapture(pos, 'white', { by: ['a1', 'a2'], target: 'b', method: 'ambush' });
    expect(v.primary.failure).toEqual({ code: 'ambush_mismatch', method: 'ambush', values: [2, 4], sum: 6, difference: 2, target: 7 });
    expect(describeExplanation(pos, v.primary)).toBe('Hinterhalt: 2 + 4 = 6, Differenz 2, dein Ziel hat 7.');
  });

  it('assault: the example from the project description', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'square', value: 15, at: 'd11' },
    ]);
    const v = explainCapture(pos, 'white', { by: ['a'], target: 'b', method: 'assault' });
    expect(v.primary.failure).toEqual({
      code: 'assault_mismatch',
      method: 'assault',
      value: 5,
      distance: 2,
      times: 10,
      divided: null,
      target: 15,
      fittingDistance: 3,
    });
    expect(describeExplanation(pos, v.primary)).toBe(
      'Angriff über zwei Felder: 5 × 2 = 10, 5 : 2 geht nicht auf, dein Ziel hat 15. Mit drei Feldern Abstand würde es passen.',
    );
  });

  it('assault: zero distance and not in line', () => {
    const adjacent = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd9' },
    ]);
    expect(explainCapture(adjacent, 'white', { by: ['a'], target: 'b', method: 'assault' }).primary.failure).toMatchObject({ code: 'zero_distance' });
    const offLine = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'f11' },
    ]);
    expect(explainCapture(offLine, 'white', { by: ['a'], target: 'b', method: 'assault' }).primary.failure).toMatchObject({ code: 'not_in_line' });
  });

  it('siege: target can move, then can be freed', () => {
    const mobile = place([
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'w', side: 'white', shape: 'round', value: 2, at: 'a2' },
    ]);
    const v1 = explainCapture(mobile, 'white', { by: ['w'], target: 'b', method: 'siege' });
    expect(v1.primary.failure).toEqual({ code: 'target_can_move', method: 'siege', moves: 1 });
    const freeable = place([
      { id: 'b', side: 'black', shape: 'round', value: 3, at: 'a1' },
      { id: 'friend', side: 'black', shape: 'round', value: 5, at: 'a2' },
      { id: 'w', side: 'white', shape: 'round', value: 2, at: 'b1' },
    ]);
    const v2 = explainCapture(freeable, 'white', { by: ['w'], target: 'b', method: 'siege' });
    expect(v2.primary.failure).toEqual({ code: 'target_can_be_freed', method: 'siege', by: 'friend' });
    expect(describeExplanation(freeable, v2.primary)).toBe('Belagerung: friend könnte das Ziel mit einem einzigen Zug befreien.');
  });

  it('reports a holding capture', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    const v = explainCapture(pos, 'white', { by: ['a'], target: 'b' });
    expect(v.holds).toBe(true);
    expect(v.primary.method).toBe('assault');
    expect(v.primary.capture?.detail).toMatchObject({ operation: 'times', result: 10 });
  });

  it('without a method, picks the most informative failure', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'b', side: 'black', shape: 'square', value: 15, at: 'd11' },
    ]);
    const v = explainCapture(pos, 'white', { by: ['a'], target: 'b' });
    expect(v.holds).toBe(false);
    expect(v.tried.map((e) => e.method)).toEqual(['meeting', 'assault', 'siege']);
    expect(v.primary.method).toBe('assault');
  });

  it('unknown pieces and own pieces as target', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'e8' },
    ]);
    expect(explainCapture(pos, 'white', { by: ['a'], target: 'zzz' }).primary.failure).toEqual({ code: 'unknown_piece', piece: 'zzz' });
    expect(explainCapture(pos, 'white', { by: ['a'], target: 'c' }).primary.failure).toEqual({ code: 'not_an_enemy', target: 'c' });
  });
});
