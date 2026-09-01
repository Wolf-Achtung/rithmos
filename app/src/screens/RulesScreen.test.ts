import { describe, expect, it } from 'vitest';
import { mebben } from '../../../engine/rules/mebben';
import { movementWording } from './rulesText';

describe('rules wording', () => {
  it('names the field Mebben names: one step is the second field', () => {
    expect(movementWording(mebben.movement.round)).toBe('ins zweite Feld');
    expect(movementWording(mebben.movement.triangle)).toBe('ins dritte Feld');
    expect(movementWording(mebben.movement.square)).toBe('ins vierte Feld');
  });
});
