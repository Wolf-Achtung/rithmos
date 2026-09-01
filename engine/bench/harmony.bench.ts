import { bench, describe } from 'vitest';
import { findCaptures } from '../capture';
import { midgamePosition } from '../fixtures/midgame';
import { findHarmonies, reachableHarmonies, reachableHarmoniesBrute } from '../harmony';
import { legalMoves } from '../moves';

const pos = midgamePosition();

describe('harmony.ts on the middle-game fixture', () => {
  bench('findHarmonies (standing)', () => {
    findHarmonies(pos, 'white');
    findHarmonies(pos, 'black');
  });

  bench('reachableHarmonies within 1 move, both sides (target-driven)', () => {
    reachableHarmonies(pos, 'white', 1);
    reachableHarmonies(pos, 'black', 1);
  });

  bench('reachableHarmoniesBrute within 1 move, both sides (reference)', () => {
    reachableHarmoniesBrute(pos, 'white');
    reachableHarmoniesBrute(pos, 'black');
  });

  bench('reachableHarmonies within 2 moves, white', () => {
    reachableHarmonies(pos, 'white', 2);
  });
});

describe('neighbours the search also pays for', () => {
  bench('legalMoves, both sides', () => {
    legalMoves(pos, 'white');
    legalMoves(pos, 'black');
  });

  bench('findCaptures, both sides', () => {
    findCaptures(pos, 'white');
    findCaptures(pos, 'black');
  });
});
