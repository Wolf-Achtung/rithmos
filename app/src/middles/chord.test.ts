import { describe, expect, it } from 'vitest';
import { chordFrequencies, intervalOf, renderChordWav } from './chord';

describe('chord of a triad', () => {
  it('keeps the ratio of the numbers above the base pitch', () => {
    expect(chordFrequencies([6, 8, 12])).toEqual([220, (220 * 8) / 6, 440]);
    expect(chordFrequencies([2, 4, 6], 100)).toEqual([100, 200, 300]);
    expect(chordFrequencies([5, 10, 20], 110)).toEqual([110, 220, 440]);
  });

  it('names the pure intervals and nothing else', () => {
    expect(intervalOf(8, 6)).toBe('fourth');
    expect(intervalOf(12, 6)).toBe('octave');
    expect(intervalOf(12, 8)).toBe('fifth');
    expect(intervalOf(6, 2)).toBe('twelfth');
    expect(intervalOf(8, 2)).toBe('doubleOctave');
    expect(intervalOf(15, 12)).toBe('majorThird');
    expect(intervalOf(12, 10)).toBe('minorThird');
    expect(intervalOf(6, 6)).toBe('unison');
    expect(intervalOf(21, 2)).toBeNull();
  });

  it('renders a well-formed mono 16-bit WAV that fades out', () => {
    const wav = renderChordWav([220, 330, 440], { seconds: 0.5, sampleRate: 8000 });
    const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(text(36, 4)).toBe('data');
    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(4000 * 2);
    expect(wav.length).toBe(44 + 4000 * 2);
    const amp = (i: number) => Math.abs(view.getInt16(44 + i * 2, true));
    const early = Math.max(...Array.from({ length: 400 }, (_, i) => amp(200 + i)));
    const late = Math.max(...Array.from({ length: 400 }, (_, i) => amp(3500 + i)));
    expect(early).toBeGreaterThan(late);
    expect(early).toBeLessThanOrEqual(32767);
  });
});
