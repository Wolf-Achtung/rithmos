import { useEffect, useMemo, useReducer } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { pieceById, squareIndex } from '../../../engine/board';
import { playTurn } from '../../../engine/game';
import { chooseMove, STRENGTH_PRESETS } from '../../../engine/search';
import { Board } from '../components/Board';
import type { Highlights } from '../components/Board';
import { availableCaptureTargets, harmonySquares, legalTargets, newGame, reduce } from '../game/store';
import type { Settings } from '../game/store';
import { texts } from '../texts';
import { colors, spacing } from '../theme';

interface Props {
  settings: Settings;
  onNewGame: () => void;
}

export function GameScreen({ settings, onNewGame }: Props) {
  const [state, dispatch] = useReducer(reduce, settings, newGame);
  const { width, height } = useWindowDimensions();
  const cellSize = Math.floor(Math.min((Math.min(width, 520) - 16) / 8, (height - 230) / 16));

  useEffect(() => {
    dispatch({ type: 'new_game', settings });
  }, [settings]);

  // The opponent runs on the JS thread after the UI has shown "thinking".
  useEffect(() => {
    if (state.phase !== 'opponent') return;
    const pos = state.position;
    const id = setTimeout(() => {
      const r = chooseMove(pos, { ...STRENGTH_PRESETS[settings.strength], seed: (Date.now() ^ state.turnNumber) & 0xffff });
      if (!r) {
        dispatch({ type: 'opponent_passed' });
        return;
      }
      dispatch({ type: 'opponent_played', turn: r.turn, result: playTurn(pos, r.turn) });
    }, 60);
    return () => clearTimeout(id);
  }, [state.phase, state.position, state.turnNumber, settings.strength]);

  const highlights = useMemo<Highlights>(() => {
    const pos = state.position;
    const attackers = new Set<number>();
    for (const id of state.attackers) {
      const p = pieceById(pos, id);
      if (p) attackers.add(squareIndex(pos.rules, p.square));
    }
    const sel = state.selected ? pieceById(pos, state.selected) : null;
    return {
      selected: sel ? squareIndex(pos.rules, sel.square) : null,
      targets: legalTargets(state),
      marked: new Set(state.marked),
      harmony: harmonySquares(state),
      attackers,
      capturable: settings.assist === 3 ? availableCaptureTargets(state) : undefined,
      lastMove: state.lastMove,
    };
  }, [state, settings.assist]);

  return (
    <View style={styles.container}>
      <Board position={state.position} perspective={settings.humanSide} cellSize={cellSize} highlights={highlights} onPress={(square) => dispatch({ type: 'tap', square })} />
      <View style={styles.panel}>
        <Text style={styles.message} testID="message">
          {state.message}
        </Text>
        <View style={styles.buttons}>
          {state.phase === 'mark' ? (
            <Button label={state.marked.length > 0 ? texts.markContinue : texts.markSkip} onPress={() => dispatch({ type: 'confirm_mark' })} testID="confirm-mark" />
          ) : null}
          {state.phase === 'capture' ? <Button label={texts.endTurn} onPress={() => dispatch({ type: 'end_turn' })} testID="end-turn" /> : null}
          {state.phase === 'over' ? <Button label={texts.newGame} onPress={onNewGame} testID="new-game" /> : null}
        </View>
        <ScrollView style={styles.log} contentContainerStyle={{ paddingBottom: spacing.sm }}>
          {[...state.log].reverse().slice(0, 12).map((line, i) => (
            <Text key={`${state.log.length - i}`} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export function Button({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  panel: { width: '100%', maxWidth: 520, paddingHorizontal: spacing.md, flex: 1 },
  message: { color: colors.ink, fontSize: 14, minHeight: 40, marginTop: spacing.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.xs },
  button: { backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  log: { flex: 1, marginTop: spacing.xs },
  logLine: { color: colors.muted, fontSize: 12, paddingVertical: 1 },
});
