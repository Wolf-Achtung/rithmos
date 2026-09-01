/**
 * A typical middle-game position for benchmarks and search tests.
 * 20 white and 20 black pieces, both sides with advanced stones in the
 * enemy half, no harmony standing, several reachable.
 */
import { place } from '../board';
import type { PieceInput } from '../board';
import type { Position } from '../types';

const WHITE_PYRAMID = [
  { value: 36, shape: 'square' },
  { value: 25, shape: 'square' },
  { value: 16, shape: 'triangle' },
  { value: 9, shape: 'triangle' },
  { value: 4, shape: 'round' },
  { value: 1, shape: 'round' },
] as const;

const BLACK_PYRAMID = [
  { value: 64, shape: 'square' },
  { value: 49, shape: 'square' },
  { value: 36, shape: 'triangle' },
  { value: 25, shape: 'triangle' },
  { value: 16, shape: 'round' },
] as const;

const pieces: PieceInput[] = [
  // white, advanced
  { side: 'white', shape: 'round', value: 2, at: 'c10' },
  { side: 'white', shape: 'round', value: 4, at: 'e10' },
  { side: 'white', shape: 'round', value: 6, at: 'b9' },
  { side: 'white', shape: 'round', value: 8, at: 'f11' },
  { side: 'white', shape: 'triangle', value: 6, at: 'd9' },
  { side: 'white', shape: 'triangle', value: 20, at: 'g9' },
  { side: 'white', shape: 'round', value: 16, at: 'a10' },
  { side: 'white', shape: 'square', value: 15, at: 'h12' },
  // white, home
  { side: 'white', shape: 'round', value: 36, at: 'd5' },
  { side: 'white', shape: 'round', value: 64, at: 'e5' },
  { side: 'white', shape: 'triangle', value: 9, at: 'b4' },
  { side: 'white', shape: 'triangle', value: 25, at: 'c7' },
  { side: 'white', shape: 'triangle', value: 42, at: 'f6' },
  { side: 'white', shape: 'triangle', value: 72, at: 'g5' },
  { side: 'white', shape: 'square', value: 45, at: 'a3' },
  { side: 'white', shape: 'square', value: 81, at: 'h2' },
  { side: 'white', shape: 'square', value: 153, at: 'c1' },
  { side: 'white', shape: 'square', value: 289, at: 'f1' },
  { side: 'white', shape: 'pyramid', components: WHITE_PYRAMID, at: 'd3' },
  { side: 'white', shape: 'round', value: 4, at: 'g7' },
  // black, advanced
  { side: 'black', shape: 'round', value: 3, at: 'e7' },
  { side: 'black', shape: 'round', value: 5, at: 'c6' },
  { side: 'black', shape: 'round', value: 7, at: 'd8' },
  { side: 'black', shape: 'round', value: 9, at: 'e6' },
  { side: 'black', shape: 'triangle', value: 12, at: 'f8' },
  { side: 'black', shape: 'triangle', value: 30, at: 'h6' },
  { side: 'black', shape: 'round', value: 25, at: 'a7' },
  { side: 'black', shape: 'square', value: 28, at: 'g4' },
  // black, home
  { side: 'black', shape: 'round', value: 49, at: 'd11' },
  { side: 'black', shape: 'round', value: 81, at: 'e12' },
  { side: 'black', shape: 'triangle', value: 16, at: 'b13' },
  { side: 'black', shape: 'triangle', value: 36, at: 'c11' },
  { side: 'black', shape: 'triangle', value: 56, at: 'f13' },
  { side: 'black', shape: 'triangle', value: 90, at: 'g12' },
  { side: 'black', shape: 'square', value: 66, at: 'a14' },
  { side: 'black', shape: 'square', value: 121, at: 'h15' },
  { side: 'black', shape: 'square', value: 225, at: 'c16' },
  { side: 'black', shape: 'square', value: 361, at: 'f16' },
  { side: 'black', shape: 'pyramid', components: BLACK_PYRAMID, at: 'e14' },
  { side: 'black', shape: 'round', value: 9, at: 'b11' },
];

export function midgamePosition(): Position {
  return place(pieces, 'white');
}
