/**
 * The hunt (Zug F): a photo of something countable, the player's guess first,
 * then the vision model counts and the engine looks for the means. The model
 * never names a harmony; the picture never reaches the engine.
 */
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, sendHunt } from '../api/client';
import type { HuntResult, Session } from '../api/client';
import { guessWasRight, harmoniesAmong } from '../middles/hunt';
import type { HuntGuess } from '../middles/hunt';
import { texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly session: Session | null;
  readonly palette: Palette;
}

type Phase = { kind: 'idle' } | { kind: 'picked'; uri: string; base64: string; mediaType: 'image/jpeg' | 'image/png' } | { kind: 'counting'; uri: string } | { kind: 'done'; uri: string; result: HuntResult; guess: HuntGuess } | { kind: 'unavailable'; note: string };

export function HuntScreen({ session, palette }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsMultipleSelection: false });
    if (res.canceled || !res.assets[0]?.base64) return;
    const asset = res.assets[0];
    const mediaType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    setPhase({ kind: 'picked', uri: asset.uri, base64: asset.base64!, mediaType });
  }

  async function guess(g: HuntGuess) {
    if (phase.kind !== 'picked') return;
    if (!session) {
      setPhase({ kind: 'unavailable', note: texts.huntUnavailable });
      return;
    }
    const { uri, base64, mediaType } = phase;
    setPhase({ kind: 'counting', uri });
    try {
      const result = await sendHunt(session, mediaType, base64);
      if (!result) setPhase({ kind: 'unavailable', note: texts.huntUnavailable });
      else setPhase({ kind: 'done', uri, result, guess: g });
    } catch (e) {
      setPhase({ kind: 'unavailable', note: e instanceof ApiError && e.status === 429 ? texts.huntTooMany : texts.huntUnavailable });
    }
  }

  const found = phase.kind === 'done' ? harmoniesAmong(phase.result.groups) : [];

  return (
    <ScrollView contentContainerStyle={styles.container} testID="hunt">
      <Text style={styles.title}>{texts.hunt}</Text>
      {phase.kind === 'idle' || phase.kind === 'unavailable' ? <Text style={styles.body}>{phase.kind === 'unavailable' ? phase.note : texts.huntIntro}</Text> : null}
      {phase.kind !== 'idle' && phase.kind !== 'unavailable' ? <Image source={{ uri: phase.uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={texts.hunt} /> : null}

      {phase.kind === 'idle' || phase.kind === 'unavailable' ? (
        <Pressable onPress={pick} style={styles.pill} testID="hunt-pick">
          <Text style={styles.pillText}>{texts.huntPick}</Text>
        </Pressable>
      ) : null}

      {phase.kind === 'picked' ? (
        <>
          <Text style={styles.body}>{texts.huntGuess}</Text>
          <View style={styles.row}>
            <Pressable onPress={() => guess('yes')} style={styles.pill} testID="hunt-yes">
              <Text style={styles.pillText}>{texts.huntYes}</Text>
            </Pressable>
            <Pressable onPress={() => guess('no')} style={styles.pillOutline} testID="hunt-no">
              <Text style={styles.pillOutlineText}>{texts.huntNo}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {phase.kind === 'counting' ? <Text style={styles.body}>{texts.huntCounting}</Text> : null}

      {phase.kind === 'done' ? (
        <>
          <Text style={styles.small}>{texts.huntCounts(phase.result.groups.length)}</Text>
          <View style={styles.counts}>
            {phase.result.groups.map((g) => (
              <View key={g.label} style={styles.count}>
                <Text style={styles.countNumber}>{g.count}</Text>
                <Text style={styles.countLabel}>{g.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.body}>{found.length === 0 ? texts.huntNone : found.map((f) => texts.huntFound(f.kind, `${f.items[0].count} ${f.items[0].label}`, `${f.items[1].count} ${f.items[1].label}`, `${f.items[2].count} ${f.items[2].label}`)).join(' ')}</Text>
          <Text style={[styles.body, { color: guessWasRight(phase.guess, found) ? palette.accent : palette.missing }]}>{guessWasRight(phase.guess, found) ? texts.huntRight : texts.huntWrong}</Text>
          <Text style={styles.small}>{texts.huntRemaining(phase.result.remaining)}</Text>
          <Text style={styles.small}>{texts.aiLabel}</Text>
          <Pressable onPress={() => setPhase({ kind: 'idle' })} style={styles.pillOutline} testID="hunt-again">
            <Text style={styles.pillOutlineText}>{texts.huntAgain}</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { gap: spacing.md, paddingBottom: spacing.md },
    title: { fontFamily: fonts.numeralBold, fontSize: type.title.fontSize, color: p.ink },
    body: { fontFamily: fonts.text, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: p.inkSoft },
    small: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted },
    photo: { width: '100%', height: 200, borderRadius: radius.card, backgroundColor: p.trackEmpty },
    row: { flexDirection: 'row', gap: spacing.md },
    pill: { height: 48, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
    pillText: { fontFamily: fonts.textMedium, fontSize: 15, color: p.accentInk },
    pillOutline: { height: 48, paddingHorizontal: 22, borderRadius: radius.pill, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
    pillOutlineText: { fontFamily: fonts.textMedium, fontSize: 15, color: p.ink },
    counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    count: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: p.border },
    countNumber: { fontFamily: fonts.numeral, fontSize: 20, color: p.accent },
    countLabel: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.inkSoft },
  });
}
