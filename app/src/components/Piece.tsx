import { StyleSheet, Text, View } from 'react-native';
import type { PlacedPiece } from '../../../engine/types';
import { colors } from '../theme';

interface Props {
  piece: PlacedPiece;
  size: number;
}

/** A stone: circle, triangle, square or pyramid (a square with a step), with its value. */
export function Piece({ piece, size }: Props) {
  const fill = piece.side === 'white' ? colors.whitePiece : colors.blackPiece;
  const ink = piece.side === 'white' ? colors.whitePieceInk : colors.blackPieceInk;
  const edge = piece.side === 'white' ? 'rgba(0,0,0,0.25)' : colors.blackPieceEdge;
  const d = size * 0.84;
  const fontSize = Math.max(9, Math.round(size * (piece.value >= 100 ? 0.3 : 0.36)));
  const label = <Text style={[styles.label, { color: ink, fontSize }]}>{piece.value}</Text>;
  if (piece.shape === 'round') {
    return <View style={[styles.base, { width: d, height: d, borderRadius: d / 2, backgroundColor: fill, borderColor: edge }]}>{label}</View>;
  }
  if (piece.shape === 'triangle') {
    return (
      <View style={{ width: d, height: d, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: 0,
            height: 0,
            borderLeftWidth: d / 2,
            borderRightWidth: d / 2,
            borderBottomWidth: d,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: fill,
          }}
        />
        <View style={{ position: 'absolute', bottom: 1, width: d - 2, height: d - 2, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ paddingBottom: d * 0.08 }}>{label}</View>
        </View>
      </View>
    );
  }
  if (piece.shape === 'square') {
    return <View style={[styles.base, { width: d, height: d, borderRadius: 2, backgroundColor: fill, borderColor: edge }]}>{label}</View>;
  }
  // pyramid: a square with a smaller stacked square, marked by a double border
  return (
    <View style={[styles.base, { width: d, height: d, borderRadius: 2, backgroundColor: fill, borderWidth: 2, borderColor: edge }]}>
      <View style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderWidth: 1, borderColor: ink, borderRadius: 1 }} />
      {label}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  label: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
