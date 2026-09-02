/**
 * The rules chat (CLAUDE.md 8.4): a question in the player's words, an answer
 * the server phrased from the rule set and checked. Shown only with a session;
 * without a model on the server the field stays and says so once asked.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, apiConfigured, askRule } from '../api/client';
import type { RuleAnswer, Session } from '../api/client';
import { texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly session: Session | null;
  readonly palette: Palette;
}

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'answer'; answer: RuleAnswer } | { kind: 'off' } | { kind: 'done' } | { kind: 'error' };

export function RulesAsk({ session, palette }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  if (!apiConfigured || !session) return null;

  async function ask() {
    const q = question.trim();
    if (q.length < 3 || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    try {
      const r = await askRule(session!, q);
      setState(r ? { kind: 'answer', answer: r } : { kind: 'off' });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 429 ? { kind: 'done' } : { kind: 'error' });
    }
  }

  const line =
    state.kind === 'busy'
      ? texts.rulesAskBusy
      : state.kind === 'off'
        ? texts.rulesAskOff
        : state.kind === 'done'
          ? texts.rulesAskDone
          : state.kind === 'error'
            ? texts.rulesAskError
            : null;

  return (
    <View style={styles.wrap} testID="rules-ask">
      <Text style={styles.label}>{texts.rulesAskTitle}</Text>
      <View style={styles.row}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={texts.rulesAskPlaceholder}
          placeholderTextColor={palette.muted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => void ask()}
          maxLength={300}
          testID="rules-ask-input"
        />
        <Pressable onPress={() => void ask()} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]} testID="rules-ask-send">
          <Text style={styles.buttonText}>{texts.rulesAsk}</Text>
        </Pressable>
      </View>
      {state.kind === 'answer' ? (
        <View style={styles.answer} testID="rules-ask-answer">
          <Text style={[styles.answerText, !state.answer.grounded && { color: palette.muted }]}>{state.answer.answer}</Text>
          <Text style={styles.small}>
            {texts.aiLabel} {texts.rulesAskRemaining(state.answer.remaining)}
          </Text>
        </View>
      ) : line ? (
        <Text style={styles.small}>{line}</Text>
      ) : null}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: p.border },
    label: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.muted, letterSpacing: 1, textTransform: 'uppercase' },
    row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    input: { flex: 1, fontFamily: fonts.text, fontSize: type.body.fontSize, color: p.ink, backgroundColor: p.surface, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    button: { borderRadius: radius.pill, backgroundColor: p.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    buttonText: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.background },
    answer: { gap: spacing.xs },
    answerText: { fontFamily: fonts.text, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: p.ink },
    small: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted },
  });
}
