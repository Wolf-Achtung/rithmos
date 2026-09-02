/**
 * No continuous synthesis on iOS and Android without a further dependency
 * (react-native-audio-api would provide it; that is a Wolf-Ping). Until then
 * the device shows the tapped offers instead of the tuning slider.
 */
import type { Drone } from './tone';

export const canTune = false;

export async function startDrone(_outer: readonly [number, number], _middle: number): Promise<Drone | null> {
  return null;
}
