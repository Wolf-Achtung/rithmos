import type { MovementRule } from '../../../engine/types';

// index = steps: one step is "the second field" because start and target are both counted
const ordinal = ['', 'zweite', 'dritte', 'vierte', 'fünfte'];

export function movementWording(rule: MovementRule): string {
  return `ins ${ordinal[rule.steps] ?? `${rule.steps + 1}.`} Feld`;
}
