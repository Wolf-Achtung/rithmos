/**
 * Rule set: Peter Mebben after Selenus 1616.
 * Source: https://jducoeur.org/game-hist/mebben.ryth.html
 *
 * Everything that is a rule lives here as data. Code elsewhere reads this,
 * it never hard-codes a value from this file.
 *
 * Piece values follow the classical construction with base numbers n:
 *   white (even) n = 2, 4, 6, 8   black (odd) n = 3, 5, 7, 9
 *   rounds    n            and n^2
 *   triangles n(n+1)       and (n+1)^2
 *   squares   (n+1)(2n+1)  and (2n+1)^2
 * One square per side is replaced by the pyramid (white 91, black 190).
 */
import type { PieceSpec, PyramidSpec, RuleSet, SideSetup } from '../types';

/**
 * Starting layout, ranks counted from the own back edge (0 = back row).
 * Rounds in front, triangles in the middle, squares and the pyramid at the back.
 * UNVERIFIED against Mebben's diagram; the source was not reachable when this
 * file was written. Values and shapes are verified by construction, only the
 * exact squares are provisional.
 */
function layout(
  rounds: readonly [number, number, number, number],
  roundSquares: readonly [number, number, number, number],
  frontTriangles: readonly [number, number],
  backTriangles: readonly [number, number, number, number, number, number],
  sideSquares: readonly [number, number],
  backSquares: readonly [number, number, number, number, number],
  pyramid: PyramidSpec['components'],
): SideSetup {
  const pieces: PieceSpec[] = [];
  // rank 3 (front): the four base rounds on files 2..5
  rounds.forEach((value, i) => pieces.push({ shape: 'round', value, file: 2 + i, rank: 3 }));
  // rank 2: two triangles on the flanks, the four square rounds in the middle
  pieces.push({ shape: 'triangle', value: frontTriangles[0], file: 1, rank: 2 });
  roundSquares.forEach((value, i) => pieces.push({ shape: 'round', value, file: 2 + i, rank: 2 }));
  pieces.push({ shape: 'triangle', value: frontTriangles[1], file: 6, rank: 2 });
  // rank 1: squares on the edges, six triangles between them
  pieces.push({ shape: 'square', value: sideSquares[0], file: 0, rank: 1 });
  backTriangles.forEach((value, i) => pieces.push({ shape: 'triangle', value, file: 1 + i, rank: 1 }));
  pieces.push({ shape: 'square', value: sideSquares[1], file: 7, rank: 1 });
  // rank 0 (back): five squares and the pyramid on files 1..6, pyramid on file 3
  const backFiles = [1, 2, 4, 5, 6];
  backSquares.forEach((value, i) => pieces.push({ shape: 'square', value, file: backFiles[i]!, rank: 0 }));
  return { pieces, pyramid: { components: pyramid, file: 3, rank: 0 } };
}

const white = layout(
  [2, 4, 6, 8],
  [4, 16, 36, 64],
  [6, 20],
  [9, 25, 42, 72, 49, 81],
  [15, 45],
  [25, 81, 153, 169, 289],
  [
    { value: 36, shape: 'square' },
    { value: 25, shape: 'square' },
    { value: 16, shape: 'triangle' },
    { value: 9, shape: 'triangle' },
    { value: 4, shape: 'round' },
    { value: 1, shape: 'round' },
  ],
);

const black = layout(
  [3, 5, 7, 9],
  [9, 25, 49, 81],
  [12, 30],
  [16, 36, 56, 90, 64, 100],
  [28, 66],
  [49, 121, 120, 225, 361],
  [
    { value: 64, shape: 'square' },
    { value: 49, shape: 'square' },
    { value: 36, shape: 'triangle' },
    { value: 25, shape: 'triangle' },
    { value: 16, shape: 'round' },
  ],
);

export const mebben: RuleSet = {
  id: 'mebben-selenus-1616',
  name: 'Peter Mebben nach Selenus 1616',
  source: 'https://jducoeur.org/game-hist/mebben.ryth.html',
  board: { files: 8, ranks: 16 },
  movement: {
    // Mebben counts start and target square. "Into the second field" is ONE step.
    round: { steps: 1, directions: 'orthogonal' },
    // "Into the third field", diagonal only: two steps.
    triangle: { steps: 2, directions: 'diagonal' },
    // "Into the fourth field", every direction: three steps.
    square: { steps: 3, directions: 'all' },
  },
  pathMustBeClear: true,
  captureTiming: 'after_move',
  pyramidComponentCapture: true,
  setup: { white, black },
  victory: {
    minor: { pieces: 3, harmonies: 1, exactly: false },
    major: { pieces: 4, harmonies: 2, exactly: true },
    greatest: { pieces: 4, harmonies: 3, exactly: false },
  },
  // Shown in the app on the rules screen, therefore in German.
  unverified: [
    'Startaufstellung: Werte und Formen sind per Konstruktion sicher, die Felder sind vorläufig',
    'Kein Springen: die Zwischenfelder eines Zuges müssen frei sein',
    'Schläge werden nach dem regulären Zug erklärt, durch beliebige eigene Steine, gegen die entstandene Stellung',
    'Formen der Pyramidenbestandteile: Quadrate, Dreiecke, Runde, vom größten Wert abwärts',
    'Ein Pyramidenbestandteil kann einzeln auf seinen Wert geschlagen werden',
    'Eine Belagerung braucht mindestens einen belagernden Stein unter den Blockern; Rand und eigene Steine allein belagern nicht',
    'Im Winkel trägt der Eckstein den mittleren Wert; im Quadrat aus vieren werden die Werte sortiert gelesen',
  ],
};
