/**
 * Playing a chord on iOS and Android: the rendered WAV is written to the
 * cache directory and handed to expo-audio. Not yet exercised on a device;
 * the web path (sound.ts) is the one verified so far.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { renderChordWav } from './chord';

let audioModeSet = false;

export async function playChord(frequencies: readonly number[]): Promise<void> {
  if (!audioModeSet) {
    audioModeSet = true;
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }
  const name = `chord-${frequencies.map((f) => Math.round(f)).join('-')}.wav`;
  const file = new File(Paths.cache, name);
  if (!file.exists) file.write(renderChordWav(frequencies));
  const player = createAudioPlayer({ uri: file.uri });
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) player.remove();
  });
  player.play();
}
