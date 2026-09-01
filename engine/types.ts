/**
 * Core types of the Rithmos engine. Pure data, no behaviour.
 */

export type Side = 'white' | 'black';

export type Shape = 'round' | 'triangle' | 'square' | 'pyramid';
export type SimpleShape = Exclude<Shape, 'pyramid'>;

export type PieceId = string;

/** Board coordinate. `file` runs across the short side (0..7), `rank` along the long side (0..15). */
export interface Square {
  readonly file: number;
  readonly rank: number;
}

/** One stone inside a pyramid. Captured components are removed from the list. */
export interface PyramidComponent {
  readonly value: number;
  readonly shape: SimpleShape;
}

export interface Piece {
  readonly id: PieceId;
  readonly side: Side;
  readonly shape: Shape;
  /** For a pyramid: the sum of its remaining components. */
  readonly value: number;
  /** Only for pyramids. */
  readonly components?: readonly PyramidComponent[];
}

export interface PlacedPiece extends Piece {
  readonly square: Square;
}

export type DirectionClass = 'orthogonal' | 'diagonal' | 'all';

export interface MovementRule {
  /** Number of squares actually travelled. Mebben counts start and target square, so "second field" is 1 step. */
  readonly steps: number;
  readonly directions: DirectionClass;
}

export interface PieceSpec {
  readonly shape: SimpleShape;
  readonly value: number;
  readonly file: number;
  /** Rank counted from the own back edge: 0 is the back row. */
  readonly rank: number;
}

export interface PyramidSpec {
  readonly components: readonly PyramidComponent[];
  readonly file: number;
  readonly rank: number;
}

export interface SideSetup {
  readonly pieces: readonly PieceSpec[];
  readonly pyramid: PyramidSpec;
}

export type VictoryClass = 'minor' | 'major' | 'greatest';

export interface VictoryRule {
  readonly pieces: 3 | 4;
  /** Number of distinct harmonies required. */
  readonly harmonies: 1 | 2 | 3;
  /** When true, exactly this many distinct harmonies, not more. */
  readonly exactly: boolean;
}

export interface RuleSet {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly board: { readonly files: number; readonly ranks: number };
  readonly movement: Readonly<Record<SimpleShape, MovementRule>>;
  /** Intermediate squares of a move must be empty (no jumping). */
  readonly pathMustBeClear: boolean;
  /** Captures are declared after the regular move, against the resulting position. */
  readonly captureTiming: 'after_move';
  /** A pyramid component can be captured on its own value. */
  readonly pyramidComponentCapture: boolean;
  readonly setup: { readonly white: SideSetup; readonly black: SideSetup };
  readonly victory: Readonly<Record<VictoryClass, VictoryRule>>;
  /** Items of this rule set that could not be checked against the source. */
  readonly unverified: readonly string[];
}

export interface Position {
  readonly rules: RuleSet;
  readonly pieces: readonly PlacedPiece[];
  /** Occupancy indexed by `rank * files + file`. */
  readonly grid: ReadonlyArray<PlacedPiece | null>;
  readonly sideToMove: Side;
}
