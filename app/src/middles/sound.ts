/**
 * Playing a chord on the web: the rendered WAV goes through the Web Audio
 * API. iOS and Android use sound.native.ts (expo-audio) instead; Metro picks
 * the platform file.
 */
import { renderChordWav } from './chord';

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** Sound the three frequencies together. Resolves when playback has started; silently does nothing without audio. */
export async function playChord(frequencies: readonly number[]): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  const wav = renderChordWav(frequencies);
  const buffer = await ctx.decodeAudioData(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}
