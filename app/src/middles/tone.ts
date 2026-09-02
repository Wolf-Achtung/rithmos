/**
 * The tuning drone for "Stimmen": two fixed tones sound, a third follows the
 * player's hand until it locks. Web Audio on the web; iOS and Android have
 * no continuous synthesis without a further dependency (tone.native.ts says
 * so), and fall back to the tapped offers.
 */

export interface Drone {
  /** move the middle tone */
  setMiddle(frequency: number): void;
  stop(): void;
}

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** Whether this platform can hold a tone under the finger. */
export const canTune = typeof (globalThis as { AudioContext?: unknown }).AudioContext !== 'undefined' || typeof (globalThis as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';

/** Start the outer tones and the movable middle; null when audio is unavailable. */
export async function startDrone(outer: readonly [number, number], middle: number): Promise<Drone | null> {
  const ctx = audioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') await ctx.resume();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(ctx.destination);
  gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.05);
  const make = (f: number) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  };
  const oscillators = [make(outer[0]), make(middle), make(outer[1])];
  return {
    setMiddle(frequency) {
      oscillators[1]!.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.015);
    },
    stop() {
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0.0001, t, 0.04);
      for (const o of oscillators) o.stop(t + 0.3);
    },
  };
}
