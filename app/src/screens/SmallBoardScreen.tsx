/**
 * The small board (CLAUDE.md, Stufe 4): 4 x 8, four stones a side, the
 * meeting, one harmony wins. Before each move the player may say why; the
 * engine checks the reason and rates the move, and the answer falls into one
 * of four fields. The opponent plays with open cards: its intent is said.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { pieceById, squareIndex } from '../../../engine/board';
import { playTurn } from '../../../engine/game';
import { chooseMove, deriveIntent, rateMove, STRENGTH_PRESETS } from '../../../engine/search';
import type { Intent } from '../../../engine/search';
import { Board } from '../components/Board';
import type { Highlights } from '../components/Board';
import { PillButton, makeTriadStyles } from '../components/Triad';
import { newSmallGame, reduceSmall, targetsOf, victorySquares } from '../game/small';
import { small } from '../../../engine/rules/small';
import type { RuleSet } from '../../../engine/types';
import type { ReasonOffer } from '../game/small';
import { texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly palette: Palette;
  /** the small board by default; Mebben's full board for those who want it */
  readonly rules?: RuleSet;
  /** the coverage step before each own move (CLAUDE.md 7): mark, then move */
  readonly withMark?: boolean;
  /** a scored marking, for the coverage records */
  readonly onCoverage?: (coverage: number) => void;
  readonly onBack?: () => void;
}

const STRENGTH = STRENGTH_PRESETS.apprentice;

function intentSentence(intent: Intent): string {
  switch (intent.kind) {
    case 'complete_harmony':
      return texts.intent.complete_harmony(intent.harmony.values);
    case 'capture':
      return texts.intent.capture(intent.captures.length);
    case 'build_harmony':
      return texts.intent.build_harmony(intent.harmony.values);
    case 'escape':
      return texts.intent.escape;
    case 'block':
      return texts.intent.block(intent.harmony.values);
    case 'develop':
      return texts.intent.develop;
  }
}

function reasonLabel(r: ReasonOffer): string {
  return texts.boardReason[r.kind](r.values);
}

export function SmallBoardScreen({ palette, rules = small, withMark = false, onCoverage, onBack }: Props) {
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeTriadStyles(palette, width, 6), [palette, width]);
  const own = useMemo(() => makeStyles(palette), [palette]);
  const [state, dispatch] = useReducer(reduceSmall, undefined, () => newSmallGame('white', rules, withMark));
  const files = state.position.rules.board.files;
  const cellSize = Math.floor(Math.min((Math.min(width, 440) - 2 * spacing.lg - 24) / files, files > 4 ? 44 : 64));
  const isSmall = state.position.rules.id === small.id;

  // the opponent plays after the screen has shown that it is thinking
  useEffect(() => {
    if (state.phase !== 'opponent') return;
    const pos = state.position;
    const id = setTimeout(() => {
      const r = chooseMove(pos, { ...STRENGTH, seed: (Date.now() ^ state.turn) & 0xffff });
      if (!r) {
        dispatch({ type: 'opponent_passed' });
        return;
      }
      dispatch({ type: 'opponent_played', turn: r.turn, result: playTurn(pos, r.turn), intent: deriveIntent(pos, r.turn) });
    }, 400);
    return () => clearTimeout(id);
  }, [state.phase, state.position, state.turn]);

  const highlights = useMemo<Highlights>(() => {
    const sel = state.selected ? pieceById(state.position, state.selected) : null;
    return {
      selected: sel ? squareIndex(state.position.rules, sel.square) : null,
      targets: targetsOf(state),
      harmony: state.phase === 'over' ? victorySquares(state) : undefined,
      marked: state.phase === 'mark' ? new Set(state.marked) : undefined,
      lastMove: state.lastMove,
    };
  }, [state]);

  function answer(id: string | null) {
    if (!state.pending) return;
    const strong = rateMove(state.position, state.pending, STRENGTH).strong;
    dispatch({ type: 'reason', id, strong });
  }

  function confirmMark() {
    dispatch({ type: 'confirm_mark' });
  }

  // a scored marking goes to the coverage records once
  const lastScored = useRef<number>(0);
  useEffect(() => {
    if (state.phase !== 'move' || state.coverage === null || !state.withMark) return;
    if (lastScored.current === state.turn) return;
    lastScored.current = state.turn;
    onCoverage?.(state.coverage);
  }, [state.phase, state.coverage, state.turn, state.withMark, onCoverage]);

  const sentence =
    state.phase === 'over'
      ? state.winner === state.humanSide
        ? texts.boardWon(state.victory?.values ?? [])
        : texts.boardLost(state.victory?.values ?? [])
      : state.phase === 'opponent'
        ? texts.boardOpponentThinks
        : state.phase === 'mark'
          ? texts.boardMarkQuestion
          : state.phase === 'reason'
            ? texts.boardWhy
            : state.withMark && state.turn > 0 && state.coverage !== null
              ? texts.boardMarkResult(Math.round(state.coverage * 100))
              : state.withMark && state.reachable.length === 0 && state.phase === 'move'
                ? texts.boardMarkNone
                : state.lastIntent
                  ? intentSentence(state.lastIntent)
                  : texts.boardYourMove;
  const verdictLine = state.verdict && state.verdict !== 'none' ? texts.verdict[state.verdict] : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="board">
      <View style={styles.header}>
        <Text style={styles.brand}>{isSmall ? texts.board : texts.boardFull}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta} testID="board-turn">
            {texts.boardTurn(state.turn)}
          </Text>
          <View style={styles.dot} />
          <Text style={[styles.headerMeta, { color: palette.accent }]}>{texts.boardSide[state.humanSide]}</Text>
        </View>
      </View>

      <View style={own.boardWrap}>
        <Board position={state.position} perspective={state.humanSide} cellSize={cellSize} highlights={highlights} onPress={(sq) => dispatch({ type: 'tap', square: sq })} />
      </View>

      <Text style={styles.sentence} testID="board-sentence">
        {sentence}
      </Text>
      {verdictLine && state.phase !== 'reason' ? (
        <Text style={[styles.small, { color: state.verdict === 'understood' ? palette.accent : state.verdict === 'luck' ? palette.missing : palette.wrong }]} testID="board-verdict">
          {verdictLine}
        </Text>
      ) : null}

      {state.phase === 'mark' ? (
        <View style={styles.after}>
          <PillButton label={texts.boardMarkContinue} onPress={confirmMark} styles={styles} testID="board-mark-continue" />
        </View>
      ) : null}

      {state.phase === 'reason' ? (
        <View style={own.reasons} testID="board-reasons">
          {state.reasons.map((r) => (
            <Pressable key={r.id} onPress={() => answer(r.id)} style={({ pressed }) => [own.reason, pressed && styles.pressed]} testID={`reason-${r.kind}`}>
              <Text style={own.reasonText}>{reasonLabel(r)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => answer(null)} style={({ pressed }) => [own.reason, own.reasonPlain, pressed && styles.pressed]} testID="reason-none">
            <Text style={[own.reasonText, { color: palette.muted }]}>{texts.boardNoReason}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {onBack ? <PillButton label={texts.boardBack} onPress={onBack} styles={styles} testID="board-back" outline /> : null}
          {isSmall ? <Text style={styles.small}>{texts.boardMeeting}</Text> : null}
        </View>
        {state.phase === 'over' ? <PillButton label={texts.boardAgain} onPress={() => dispatch({ type: 'new_game', humanSide: 'white' })} styles={styles} testID="board-again" /> : null}
      </View>
    </ScrollView>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    boardWrap: { marginTop: spacing.lg, alignItems: 'center' },
    reasons: { gap: spacing.sm, marginTop: spacing.md },
    reason: { borderRadius: radius.card, borderWidth: 1, borderColor: p.accent, backgroundColor: p.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
    reasonPlain: { borderColor: p.border },
    reasonText: { fontFamily: fonts.textMedium, fontSize: type.body.fontSize, color: p.ink },
  });
}
