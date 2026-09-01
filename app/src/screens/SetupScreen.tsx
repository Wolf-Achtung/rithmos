import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Side } from '../../../engine/types';
import type { AssistLevel, Settings, Strength } from '../game/store';
import { sideName, texts } from '../texts';
import { colors, spacing } from '../theme';
import { Button } from './GameScreen';

interface Props {
  initial: Settings;
  onStart: (settings: Settings) => void;
}

function Choice<T extends string | number>({ label, options, value, onChange, name }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; name: (v: T) => string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((o) => (
          <Pressable key={String(o)} onPress={() => onChange(o)} style={[styles.chip, o === value && styles.chipActive]} testID={`choice-${String(o)}`}>
            <Text style={[styles.chipText, o === value && styles.chipTextActive]}>{name(o)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function SetupScreen({ initial, onStart }: Props) {
  const [humanSide, setSide] = useState<Side>(initial.humanSide);
  const [strength, setStrength] = useState<Strength>(initial.strength);
  const [assist, setAssist] = useState<AssistLevel>(initial.assist);
  return (
    <View style={styles.container}>
      <Choice label={texts.side} options={['white', 'black'] as const} value={humanSide} onChange={setSide} name={(s) => sideName[s]} />
      <Choice label={texts.strength} options={['novice', 'apprentice', 'master'] as const} value={strength} onChange={setStrength} name={(s) => texts.strengthName[s]} />
      <Choice label={texts.assist} options={[3, 2, 1, 0] as const} value={assist} onChange={setAssist} name={(a) => texts.assistName[a]} />
      <Button label={texts.start} onPress={() => onStart({ humanSide, strength, assist })} testID="start" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  group: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
