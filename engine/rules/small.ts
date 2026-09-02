/**
 * Rule set: the small board (CLAUDE.md, Stufe 4). Mebben's game cut down to
 * what a first match needs: 4 x 8 squares, four stones a side, one way to
 * capture (the meeting), and one way to win (a harmony of three in the
 * enemy half). Movement, harmonies and the meeting are Mebben's, unchanged;
 * this file only chooses less of them.
 *
 * Values: white 2, 4, 6, 8 and black 3, 6, 9, 12 — three harmonies a side
 * (two arithmetic, one geometric), so both sides have the same chances.
 */
import type { PieceSpec, RuleSet } from '../types';
import { mebben } from './mebben';

const white: PieceSpec[] = [
  { shape: 'round', value: 2, file: 1, rank: 1 },
  { shape: 'round', value: 4, file: 2, rank: 1 },
  { shape: 'triangle', value: 6, file: 0, rank: 0 },
  { shape: 'square', value: 8, file: 3, rank: 0 },
];

const black: PieceSpec[] = [
  { shape: 'round', value: 3, file: 2, rank: 1 },
  { shape: 'round', value: 6, file: 1, rank: 1 },
  { shape: 'triangle', value: 9, file: 3, rank: 0 },
  { shape: 'square', value: 12, file: 0, rank: 0 },
];

export const small: RuleSet = {
  id: 'small-4x8',
  name: 'Das kleine Brett, nach Mebben',
  source: mebben.source,
  board: { files: 4, ranks: 8 },
  movement: mebben.movement,
  pathMustBeClear: mebben.pathMustBeClear,
  captureTiming: 'after_move',
  pyramidComponentCapture: false,
  captureMethods: ['meeting'],
  setup: { white: { pieces: white }, black: { pieces: black } },
  victory: mebben.victory,
  unverified: ['Das kleine Brett ist eine Lehrform dieses Projekts, keine historische Fassung: Werte, Aufstellung und die Beschränkung auf die Begegnung sind gesetzt, nicht überliefert'],
};
