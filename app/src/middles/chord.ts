/**
 * The chord of a triad. The three numbers become three frequencies in the
 * ratio a : b : c above a free base pitch (CLAUDE.md, die Klang-Spalte). The
 * tones are rendered here as a WAV in memory, never shipped as files; the
 * platform modules only play the bytes.
 */

export const BASE_FREQUENCY = 220;

/** Frequencies in the ratio a : b : c, the lowest at the base pitch. */
export function chordFrequencies(values: readonly [number, number, number], base = BASE_FREQUENCY): [number, number, number] {
  const [a, b, c] = values;
  return [base, (base * b) / a, (base * c) / a];
}

export type Interval = 'unison' | 'minorThird' | 'majorThird' | 'fourth' | 'fifth' | 'octave' | 'twelfth' | 'doubleOctave';

const INTERVALS: readonly { readonly num: number; readonly den: number; readonly name: Interval }[] = [
  { num: 1, den: 1, name: 'unison' },
  { num: 6, den: 5, name: 'minorThird' },
  { num: 5, den: 4, name: 'majorThird' },
  { num: 4, den: 3, name: 'fourth' },
  { num: 3, den: 2, name: 'fifth' },
  { num: 2, den: 1, name: 'octave' },
  { num: 3, den: 1, name: 'twelfth' },
  { num: 4, den: 1, name: 'doubleOctave' },
];

/** The interval of value over root when it is one of the pure ones; null otherwise. */
export function intervalOf(value: number, root: number): Interval | null {
  for (const i of INTERVALS) if (value * i.den === root * i.num) return i.name;
  return null;
}

export interface RenderOptions {
  readonly seconds?: number;
  readonly sampleRate?: number;
}

/**
 * A WAV (PCM 16 bit, mono) of the three tones sounding together: each a sine
 * with a soft second partial, a short attack and a long release.
 */
export function renderChordWav(frequencies: readonly number[], opts: RenderOptions = {}): Uint8Array {
  const seconds = opts.seconds ?? 1.8;
  const sampleRate = opts.sampleRate ?? 22050;
  const n = Math.floor(seconds * sampleRate);
  const data = new Int16Array(n);
  const gain = 0.8 / Math.max(1, frequencies.length);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.02);
    const release = Math.exp(-2.2 * t);
    let s = 0;
    for (const f of frequencies) s += Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t);
    data[i] = Math.round(Math.max(-1, Math.min(1, s * gain * attack * release)) * 32767);
  }
  return wavFromPcm16(data, sampleRate);
}

function wavFromPcm16(samples: Int16Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i]!, true);
  return bytes;
}
