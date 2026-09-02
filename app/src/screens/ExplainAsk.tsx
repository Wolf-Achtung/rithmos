/**
 * "Erklär es mir" (CLAUDE.md 6, on the daily puzzle): after the day is
 * finished the player says in their own words why the number is the middle.
 * The model only translates the words into a pattern; the engine's kind and
 * the day's result decide which of the four fields it falls into.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, explainAnswer } from '../api/client';
import type { ExplainResult, Session } from '../api/client';
import { texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly session: Session;
  readonly date: string;
  readonly palette: Palette;
}

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; result: ExplainResult } | { kind: 'spent' } | { kind: 'off' } | { kind: 'error' };

export function ExplainAsk({ session, date, palette }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function send() {
    const t = text.trim();
    if (t.length < 3 || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    try {
      const r = await explainAnswer(session, date, t);
      setState(r ? { kind: 'done', result: r } : { kind: 'off' });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 429 ? { kind: 'spent' } : { kind: 'error' });
    }
  }

  if (state.kind === 'done') {
    const color = state.result.verdict === 'understood' ? palette.accent : state.result.verdict === 'luck' ? palette.missing : state.result.verdict === 'none' ? palette.muted : palette.wrong;
    return (
      <View style={styles.wrap} testID="explain-verdict">
        <Text style={[styles.verdict, { color }]}>{texts.explainVerdict[state.result.verdict]}</Text>
        <Text style={styles.small}>{texts.aiLabel}</Text>
      </View>
    );
  }
  if (state.kind === 'spent' || state.kind === 'off') {
    return (
      <Text style={styles.small} testID="explain-note">
        {state.kind === 'spent' ? texts.explainSpent : texts.explainOff}
      </Text>
    );
  }
  return (
    <View style={styles.wrap} testID="explain">
      <Text style={styles.label}>{texts.explainTitle}</Text>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={texts.explainPlaceholder}
          placeholderTextColor={palette.muted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          maxLength={300}
          testID="explain-input"
        />
        <Pressable onPress={() => void send()} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]} testID="explain-send">
          <Text style={styles.buttonText}>{state.kind === 'busy' ? '…' : texts.explainSend}</Text>
        </Pressable>
      </View>
      {state.kind === 'error' ? <Text style={styles.small}>{texts.rulesAskError}</Text> : null}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
    label: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.muted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
    row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    input: { flex: 1, fontFamily: fonts.text, fontSize: type.body.fontSize, color: p.ink, backgroundColor: p.surface, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    button: { borderRadius: radius.pill, backgroundColor: p.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    buttonText: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.accentInk },
    verdict: { fontFamily: fonts.text, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, textAlign: 'center' },
    small: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted, textAlign: 'center' },
  });
}
