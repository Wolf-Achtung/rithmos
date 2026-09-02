/**
 * The shared picture of a harmony: numerals that bob while the chord sounds,
 * rows of bars shaped like waves, offers to tap. The daily puzzle and the
 * practice screens compose these.
 */
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { intervalOf } from '../middles/chord';
import { texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

export type Swing = SharedValue<number>;
export type TriadStyles = ReturnType<typeof makeTriadStyles>;

/** A numeral that bobs while the chord sounds: the higher its share of the ratio, the quicker. */
export function Numeral({ value, styles, swing, rate, accent, testID }: { value: number | string; styles: TriadStyles; swing: Swing; rate: number; accent?: 'accent' | 'missing'; testID?: string }) {
  const style = useAnimatedStyle(() => {
    const s = swing.value;
    const amp = s === 0 || s === 1 ? 0 : 6 * Math.sin(Math.PI * s);
    return { transform: [{ translateY: -amp * Math.abs(Math.sin(2 * Math.PI * rate * s * 2)) }] };
  });
  return (
    <Animated.Text style={[styles.numeral, accent === 'accent' && styles.numeralAccent, accent === 'missing' && styles.numeralMissing, style]} testID={testID}>
      {value}
    </Animated.Text>
  );
}

const BARS = 36;

/** A row of bars shaped like a sine wave with the given number of cycles; travels while the chord sounds. */
export function Wave({ cycles, label, styles, swing, color, muted }: { cycles: number; label: string; styles: TriadStyles; swing: Swing; color: string; muted: string }) {
  return (
    <View style={styles.waveRow}>
      <View style={styles.wave}>
        {Array.from({ length: BARS }, (_, i) => (
          <Bar key={i} index={i} cycles={cycles} swing={swing} style={[styles.bar, { backgroundColor: cycles > 0 ? color : muted }]} />
        ))}
      </View>
      <Text style={[styles.waveLabel, { color: cycles > 0 ? undefined : muted }]}>{label}</Text>
    </View>
  );
}

function Bar({ index, cycles, swing, style }: { index: number; cycles: number; swing: Swing; style: object[] }) {
  const animated = useAnimatedStyle(() => {
    if (cycles === 0) return { transform: [{ scaleY: 0.12 }] };
    const x = index / BARS;
    const h = Math.abs(Math.sin(2 * Math.PI * (cycles * x - swing.value * 2)));
    return { transform: [{ scaleY: 0.12 + 0.88 * h }] };
  });
  return <Animated.View style={[...style, animated]} />;
}

/** `42 · Quinte` when the interval over the root is a pure one. */
export function intervalLabel(value: number, root: number): string {
  const i = intervalOf(value, root);
  return i && i !== 'unison' ? `${value} · ${texts.intervalName[i]}` : String(value);
}

/** One offer to tap; struck through once it was wrong, filled once it was right. */
export function Offer({ label, onPress, state, styles, testID, wide }: { label: string; onPress: () => void; state: 'open' | 'wrong' | 'right'; styles: TriadStyles; testID: string; wide?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={state !== 'open'}
      testID={testID}
      style={({ pressed }) => [styles.offer, wide && styles.offerWide, state === 'wrong' && styles.offerWrong, state === 'right' && styles.offerRight, pressed && state === 'open' && styles.pressed]}
    >
      <Text style={[styles.offerText, wide && styles.offerTextWide, state === 'wrong' && styles.offerTextWrong, state === 'right' && styles.offerTextRight]}>{label}</Text>
    </Pressable>
  );
}

/** The one pill button of a screen. */
export function PillButton({ label, onPress, styles, testID, outline }: { label: string; onPress: () => void; styles: TriadStyles; testID: string; outline?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [outline ? styles.pillOutline : styles.pill, pressed && styles.pressed]} testID={testID}>
      <Text style={outline ? styles.pillOutlineText : styles.pillText}>{label}</Text>
    </Pressable>
  );
}

export function makeTriadStyles(p: Palette, width: number, digits: number, slots = 3) {
  // Bricolage digits run about 0.58 em wide at this tracking; gaps sit between the numerals
  const room = Math.min(width, 440) - 2 * spacing.lg - (slots - 1) * spacing.lg;
  const numeralSize = Math.min(type.numeral.fontSize, Math.floor(room / (digits * 0.58)));
  const glow = (color: string) => ({ textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: Platform.OS === 'web' ? 28 : 18 });
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.background },
    container: { flexGrow: 1, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brand: { fontFamily: fonts.numeralBold, fontSize: type.title.fontSize, letterSpacing: type.title.letterSpacing, color: p.ink },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerMeta: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: p.muted },
    gear: { fontFamily: fonts.numeralBold, fontSize: 22, color: p.muted, marginLeft: spacing.xs, lineHeight: 24 },
    numbers: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xxl },
    numeral: { fontFamily: fonts.numeralLight, fontSize: numeralSize, lineHeight: numeralSize * 1.08, letterSpacing: type.numeral.letterSpacing * (numeralSize / type.numeral.fontSize), color: p.ink, textAlign: 'center', flexShrink: 0 },
    numeralAccent: { fontFamily: fonts.numeral, color: p.accent, ...glow(p.accentGlow) },
    numeralMissing: { fontFamily: fonts.numeral, color: p.missing, ...glow(p.missingGlow) },
    numeralLive: { fontFamily: fonts.numeralLight, fontSize: numeralSize * 0.7, lineHeight: numeralSize * 1.08 },
    waves: { marginTop: spacing.xl, gap: spacing.md },
    waveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    wave: { flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', gap: 3 },
    bar: { flex: 1, height: 28, borderRadius: 2 },
    waveLabel: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted, width: 104 },
    sentence: { fontFamily: fonts.text, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: p.inkSoft, textAlign: 'center', marginTop: spacing.xl, minHeight: type.body.lineHeight * 2 },
    offers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
    offer: { flexBasis: '44%', flexGrow: 1, height: 76, borderRadius: radius.card, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
    offerWide: { flexBasis: '100%', height: 60 },
    pressed: { opacity: 0.7 },
    offerWrong: { borderColor: p.wrong, opacity: 0.45 },
    offerRight: { borderColor: p.accent, backgroundColor: p.accent },
    offerText: { fontFamily: fonts.numeral, fontSize: type.offer.fontSize, letterSpacing: type.offer.letterSpacing, color: p.ink },
    offerTextWide: { fontFamily: fonts.textMedium, fontSize: type.body.fontSize, letterSpacing: 0 },
    offerTextWrong: { color: p.wrong, textDecorationLine: 'line-through' },
    offerTextRight: { color: p.accentInk },
    after: { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    pill: { height: 48, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' },
    pillText: { fontFamily: fonts.textMedium, fontSize: 15, color: p.accentInk },
    pillOutline: { height: 44, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
    pillOutlineText: { fontFamily: fonts.textMedium, fontSize: 14, color: p.ink },
    small: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted, textAlign: 'center' },
    footer: { flexGrow: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.xl },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    boxes: { flexDirection: 'row', gap: 5 },
    box: { width: 14, height: 14, borderRadius: radius.box, backgroundColor: p.trackEmpty },
    boxWrong: { backgroundColor: p.wrong },
    boxSolved: { backgroundColor: p.accent },
    voices: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
    voice: { fontFamily: fonts.text, fontSize: type.small.fontSize + 1, lineHeight: type.small.lineHeight + 4, color: p.inkSoft },
    voiceName: { fontFamily: fonts.textMedium, color: p.ink },
    statement: { borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    statementTrue: { borderColor: p.accent },
    statementLie: { borderColor: p.wrong, opacity: 0.6 },
    statementText: { fontFamily: fonts.text, fontSize: type.small.fontSize + 1, lineHeight: type.small.lineHeight + 4, color: p.ink },
    aiLabel: { fontFamily: fonts.text, fontSize: 11, color: p.muted, textAlign: 'center', marginTop: spacing.xs },
  });
}
