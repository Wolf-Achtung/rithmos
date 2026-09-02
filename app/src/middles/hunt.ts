/**
 * The hunt (Zug F): the vision model counts things in a photo; the engine
 * decides which of the counts form a harmony. Pure functions over counts —
 * the model never names a harmony, the engine never sees the picture.
 */
import { harmonyKinds } from '../../../engine/harmony';
import type { HarmonyKind } from '../../../engine/harmony';

export interface Counted {
  readonly label: string;
  readonly count: number;
}

export interface FoundHarmony {
  readonly kind: HarmonyKind;
  readonly items: readonly [Counted, Counted, Counted];
}

/** Every ascending triple of distinct counts that forms a harmony. */
export function harmoniesAmong(groups: readonly Counted[]): FoundHarmony[] {
  const sorted = [...groups].sort((x, y) => x.count - y.count);
  const out: FoundHarmony[] = [];
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++)
      for (let k = j + 1; k < sorted.length; k++) {
        const [a, b, c] = [sorted[i]!, sorted[j]!, sorted[k]!];
        if (a.count === b.count || b.count === c.count) continue;
        const kind = harmonyKinds(a.count, b.count, c.count)[0];
        if (kind) out.push({ kind, items: [a, b, c] });
      }
  return out;
}

/** The player's guess before the model answers: is there a harmony in the picture? */
export type HuntGuess = 'yes' | 'no';

export function guessWasRight(guess: HuntGuess, found: readonly FoundHarmony[]): boolean {
  return (guess === 'yes') === found.length > 0;
}
