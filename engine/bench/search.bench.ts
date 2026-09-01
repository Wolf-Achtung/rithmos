import { bench, describe } from 'vitest';
import { withPieces } from '../board';
import { midgamePosition } from '../fixtures/midgame';
import { chooseMove, STRENGTH_PRESETS } from '../search';

// The fixture lets both sides win in one move, which short-circuits the search.
// Without the two completing rounds it has to think.
const full = midgamePosition();
const pos = withPieces(full, full.pieces.filter((p) => p.id !== 'Wr4' && p.id !== 'Br7'));

describe('search.ts presets on the middle-game fixture', () => {
  bench('novice (depth 1)', () => {
    chooseMove(pos, STRENGTH_PRESETS.novice);
  });
  bench('apprentice (depth 2, breadth 10)', () => {
    chooseMove(pos, STRENGTH_PRESETS.apprentice);
  }, { iterations: 5, time: 0 });
  bench('master (depth 3, breadth 6)', () => {
    chooseMove(pos, STRENGTH_PRESETS.master);
  }, { iterations: 3, time: 0 });
});
