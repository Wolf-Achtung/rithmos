import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FILE_LETTERS, isEnemyHalf, squareIndex } from '../../../engine/board';
import type { Move } from '../../../engine/moves';
import type { PlacedPiece, Position, Side, Square } from '../../../engine/types';
import { colors } from '../theme';
import { Piece } from './Piece';

export interface Highlights {
  selected?: number | null;
  targets?: ReadonlySet<number>;
  marked?: ReadonlySet<number>;
  harmony?: ReadonlySet<number>;
  attackers?: ReadonlySet<number>;
  capturable?: ReadonlySet<number>;
  lastMove?: Move | null;
}

interface Props {
  position: Position;
  /** The side shown at the bottom. */
  perspective: Side;
  cellSize: number;
  highlights: Highlights;
  onPress: (square: Square) => void;
}

/**
 * The 8 x 16 board as plain views. Ranks run from the top of the screen
 * down to the perspective side's back rank.
 */
export function Board({ position, perspective, cellSize, highlights, onPress }: Props) {
  const { files, ranks } = position.rules.board;
  const rankOrder = [...Array(ranks).keys()];
  const fileOrder = [...Array(files).keys()];
  if (perspective === 'white') rankOrder.reverse();
  else fileOrder.reverse();
  const byIndex = new Map<number, PlacedPiece>();
  for (const p of position.pieces) byIndex.set(squareIndex(position.rules, p.square), p);

  const gutter = Math.max(12, Math.round(cellSize * 0.4));
  const coordStyle = { fontSize: Math.max(8, Math.round(cellSize * 0.24)), color: colors.muted };
  return (
    <View style={{ alignSelf: 'center' }}>
      <View style={styles.row}>
        <View style={{ width: gutter }}>
          {rankOrder.map((rank) => (
            <View key={rank} style={{ height: cellSize, justifyContent: 'center' }}>
              <Text style={coordStyle}>{rank + 1}</Text>
            </View>
          ))}
        </View>
    <View style={[styles.board, { width: cellSize * files, borderColor: colors.border }]}>
      {rankOrder.map((rank) => (
        <View key={rank} style={styles.row}>
          {fileOrder.map((file) => {
            const sq: Square = { file, rank };
            const idx = squareIndex(position.rules, sq);
            const piece = byIndex.get(idx);
            const dark = (file + rank) % 2 === 1;
            const overlays: string[] = [];
            if (highlights.lastMove && ((highlights.lastMove.from.file === file && highlights.lastMove.from.rank === rank) || (highlights.lastMove.to.file === file && highlights.lastMove.to.rank === rank))) overlays.push(colors.lastMove);
            if (highlights.harmony?.has(idx)) overlays.push(colors.harmony);
            if (highlights.marked?.has(idx)) overlays.push(colors.marked);
            if (highlights.targets?.has(idx)) overlays.push(colors.target);
            if (highlights.attackers?.has(idx)) overlays.push(colors.attacker);
            const selected = highlights.selected === idx;
            const enemyHalf = isEnemyHalf(position.rules, perspective, sq);
            return (
              <Pressable
                key={file}
                testID={`sq-${FILE_LETTERS[file]}${rank + 1}`}
                onPress={() => onPress(sq)}
                style={[
                  styles.cell,
                  { width: cellSize, height: cellSize, backgroundColor: dark ? colors.squareDark : colors.squareLight },
                ]}
              >
                {enemyHalf ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.enemyHalfTint }]} /> : null}
                {overlays.map((c, i) => (
                  <Animated.View key={i} entering={FadeIn.duration(120)} style={[StyleSheet.absoluteFill, { backgroundColor: c }]} />
                ))}
                {selected ? <View style={[StyleSheet.absoluteFill, { borderWidth: 3, borderColor: colors.selected }]} /> : null}
                {highlights.capturable?.has(idx) ? <View style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: colors.danger, borderStyle: 'dashed' }]} /> : null}
                {piece ? <Piece piece={piece} size={cellSize} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
      </View>
      <View style={[styles.row, { marginLeft: gutter }]}>
        {fileOrder.map((file) => (
          <View key={file} style={{ width: cellSize, alignItems: 'center' }}>
            <Text style={coordStyle}>{FILE_LETTERS[file]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderWidth: 1, alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center' },
});
