import { describe, expect, it } from 'vitest';
import { guessWasRight, harmoniesAmong } from './hunt';

describe('the hunt', () => {
  it('finds the harmonies among counted things, the engine deciding', () => {
    const found = harmoniesAmong([
      { label: 'Stühle', count: 12 },
      { label: 'Bücher', count: 6 },
      { label: 'Tassen', count: 9 },
      { label: 'Fenster', count: 8 },
    ]);
    expect(found.map((f) => `${f.kind}:${f.items.map((i) => i.count).join('-')}`).sort()).toEqual(['arithmetic:6-9-12', 'musical:6-8-12']);
    expect(found.find((f) => f.kind === 'musical')!.items.map((i) => i.label)).toEqual(['Bücher', 'Fenster', 'Stühle']);
    expect(harmoniesAmong([{ label: 'a', count: 3 }, { label: 'b', count: 5 }])).toEqual([]);
    expect(harmoniesAmong([{ label: 'a', count: 4 }, { label: 'b', count: 4 }, { label: 'c', count: 4 }])).toEqual([]);
  });

  it('scores the guess against what the engine found', () => {
    const found = harmoniesAmong([{ label: 'a', count: 2 }, { label: 'b', count: 4 }, { label: 'c', count: 6 }]);
    expect(guessWasRight('yes', found)).toBe(true);
    expect(guessWasRight('no', found)).toBe(false);
    expect(guessWasRight('no', [])).toBe(true);
  });
});
