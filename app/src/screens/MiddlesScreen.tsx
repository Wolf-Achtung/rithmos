/**
 * Middles without the board (CLAUDE.md, Stufe 1). One screen: two numbers
 * stand, the middle is missing, four offers, three tries. On the right answer
 * the three numbers swing together, the chord sounds, one sentence appears.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { meanOf } from '../../../engine/harmony';
import { generateMiddles, isoDate, middlesNumber } from '../../../jobs/src/middles';
import type { Triad } from '../../../jobs/src/middles';
import { apiConfigured, fetchDistribution, fetchTodayPuzzle, submitAttempt } from '../api/client';
import type { Distribution, Session } from '../api/client';
import { chordFrequencies, intervalOf } from '../middles/chord';
import { MAX_TRIES, feedbackFor, isFinished, recordAnswer, shareText, streakOn, triesOf } from '../middles/logic';
import type { DayResult } from '../middles/logic';
import { playChord } from '../middles/sound';
import { store } from '../storage';
import { texts, triadSentence } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

const RESULTS_KEY = 'middles:results';

interface Props {
  readonly session: Session | null;
  readonly palette: Palette;
  readonly soundOn: boolean;
  readonly onOpenSettings: () => void;
}

interface Loaded {
  readonly date: string;
  readonly triad: Triad;
  readonly b: number;
  readonly source: 'api' | 'local';
}

async function loadToday(session: Session | null): Promise<Loaded> {
  const today = isoDate(Date.now());
  if (apiConfigured) {
    try {
      const puzzle = await fetchTodayPuzzle(session);
      if (puzzle?.triad) {
        const b = meanOf(puzzle.triad.kind, puzzle.triad.a, puzzle.triad.c);
        if (b !== null && puzzle.triad.options.includes(b)) return { date: puzzle.date, triad: puzzle.triad, b, source: 'api' };
      }
    } catch {
      // offline: the generator in the bundle takes over
    }
  }
  const local = generateMiddles(today);
  return { date: local.date, triad: local.triad, b: local.solution.b, source: 'local' };
}

async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    try {
      const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator?.clipboard;
      if (!clipboard) return 'failed';
      await clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

export function MiddlesScreen({ session, palette, soundOn, onOpenSettings }: Props) {
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // the three numerals share one line: size them by the digits they need
  const digits = loaded ? String(loaded.triad.a).length + String(loaded.triad.c).length + Math.max(...loaded.triad.options.map((v) => String(v).length)) : 6;
  const styles = useMemo(() => makeStyles(palette, width, digits), [palette, width, digits]);
  const [results, setResults] = useState<DayResult[]>([]);
  const [ready, setReady] = useState(false);
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const started = useRef(Date.now());
  const submitted = useRef(false);
  const swing = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [stored, l] = await Promise.all([store.read<DayResult[]>(RESULTS_KEY, []), loadToday(session)]);
      if (!alive) return;
      setResults(stored);
      setLoaded(l);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  const today = loaded ? results.find((r) => r.date === loaded.date) : undefined;
  const finished = isFinished(today);
  const lastAnswer = today?.answers[today.answers.length - 1];
  const feedback = loaded && lastAnswer !== undefined ? feedbackFor(loaded.triad, lastAnswer) : null;

  // the settlement of a finished day: sound, swing, the attempt on the server
  useEffect(() => {
    if (!loaded || !finished || submitted.current) return;
    submitted.current = true;
    if (today?.solved) {
      swing.value = withSequence(withTiming(1, { duration: 1800, easing: Easing.linear }), withTiming(0, { duration: 0 }));
      if (soundOn) void playChord(chordFrequencies([loaded.triad.a, loaded.b, loaded.triad.c])).catch(() => undefined);
    }
    if (loaded.source === 'api' && session && lastAnswer !== undefined) {
      const seconds = Math.round((Date.now() - started.current) / 1000);
      submitAttempt(session, loaded.date, { answer: lastAnswer, tries: triesOf(today!) }, seconds)
        .then((r) => setDistribution(r.distribution))
        .catch(() => fetchDistribution(loaded.date).then(setDistribution).catch(() => undefined));
    }
    return () => cancelAnimation(swing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, finished]);

  function tap(answer: number) {
    if (!loaded || finished) return;
    const solved = feedbackFor(loaded.triad, answer).kind === 'right';
    const next = recordAnswer(results, loaded.date, answer, solved);
    setResults(next);
    void store.write(RESULTS_KEY, next);
  }

  async function listen() {
    if (!loaded) return;
    swing.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1800, easing: Easing.linear }), withTiming(0, { duration: 0 }));
    await playChord(chordFrequencies([loaded.triad.a, loaded.b, loaded.triad.c])).catch(() => undefined);
  }

  async function share() {
    if (!loaded || !today) return;
    const outcome = await shareResult(shareText(loaded.date, today));
    setShareNote(outcome === 'copied' ? texts.triadCopied : null);
  }

  if (!ready || !loaded) return <View style={styles.root} testID="middles-loading" />;

  const { triad, b } = loaded;
  const number = middlesNumber(loaded.date);
  const streak = streakOn(results, loaded.date);
  const solved = !!today?.solved;
  const tries = today ? triesOf(today) : 0;
  const sentence = finished
    ? solved
      ? triadSentence(triad.kind, triad.a, b, triad.c, number)
      : texts.triadRevealed(b)
    : feedback?.kind === 'otherMean'
      ? texts.triadOtherMean(lastAnswer!, feedback.mean)
      : feedback?.kind === 'wrong'
        ? texts.triadWrong(lastAnswer!)
        : texts.triadQuestion(triad.kind);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="middles">
      <View style={styles.header}>
        <Text style={styles.brand}>{texts.middles}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta} testID="middles-number">
            {texts.triadNumber(number)}
          </Text>
          {streak > 0 ? (
            <>
              <View style={styles.dot} />
              <Text style={[styles.headerMeta, { color: palette.accent }]} testID="middles-streak">
                {texts.triadStreak(streak)}
              </Text>
            </>
          ) : null}
          <Pressable onPress={onOpenSettings} testID="settings-open" hitSlop={12} accessibilityLabel={texts.settings}>
            <Text style={styles.gear}>···</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.numbers} testID="middles-numbers">
        <Numeral value={triad.a} styles={styles} swing={swing} rate={1} />
        {finished ? (
          <Numeral value={b} styles={styles} swing={swing} rate={b / triad.a} accent={solved ? 'accent' : 'missing'} testID="middles-answer" />
        ) : (
          <Text style={[styles.numeral, styles.numeralMissing]} testID="middles-missing">
            ?
          </Text>
        )}
        <Numeral value={triad.c} styles={styles} swing={swing} rate={triad.c / triad.a} />
      </View>

      <View style={styles.waves}>
        <Wave cycles={1} label={String(triad.a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
        <Wave
          cycles={finished ? b / triad.a : 0}
          label={finished ? `${b}${intervalLabel(b, triad.a)}` : '?'}
          styles={styles}
          swing={swing}
          color={solved ? palette.accent : palette.missing}
          muted={palette.muted}
        />
        <Wave cycles={triad.c / triad.a} label={`${triad.c}${intervalLabel(triad.c, triad.a)}`} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
      </View>

      <Text style={styles.sentence} testID="middles-sentence">
        {sentence}
      </Text>

      {!finished ? (
        <View style={styles.offers} testID="middles-offers">
          {triad.options.map((v) => {
            const tapped = today?.answers.includes(v) ?? false;
            return (
              <Pressable
                key={v}
                onPress={() => tap(v)}
                disabled={tapped}
                testID={`offer-${v}`}
                style={({ pressed }) => [styles.offer, tapped && styles.offerWrong, pressed && !tapped && styles.offerPressed]}
              >
                <Text style={[styles.offerText, tapped && styles.offerTextWrong]}>{v}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.after}>
          <Pressable onPress={listen} style={({ pressed }) => [styles.listen, pressed && styles.offerPressed]} testID="middles-listen">
            <Text style={styles.listenText}>{texts.triadListen}</Text>
          </Pressable>
          {distribution ? (
            <Text style={styles.small} testID="middles-distribution">
              {texts.triadDistribution(distribution.attempts, distribution.solved)}
            </Text>
          ) : null}
          {loaded.source === 'local' ? <Text style={styles.small}>{texts.triadOffline}</Text> : null}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.boxes} testID="middles-boxes">
            {Array.from({ length: MAX_TRIES }, (_, i) => {
              const used = i < tries;
              const isSolve = solved && i === tries - 1;
              return <View key={i} style={[styles.box, used && (isSolve ? styles.boxSolved : styles.boxWrong)]} />;
            })}
          </View>
          <Text style={styles.small} testID="middles-score">
            {finished ? texts.triadScore(number, solved ? tries : null, MAX_TRIES) : texts.triadTry(Math.min(tries + 1, MAX_TRIES), MAX_TRIES)}
          </Text>
        </View>
        {finished ? (
          <Pressable onPress={share} style={({ pressed }) => [styles.share, pressed && styles.offerPressed]} testID="middles-share">
            <Text style={styles.shareText}>{shareNote ?? texts.triadShare}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function intervalLabel(value: number, root: number): string {
  const i = intervalOf(value, root);
  return i && i !== 'unison' ? ` · ${texts.intervalName[i]}` : '';
}

type Styles = ReturnType<typeof makeStyles>;
type Swing = SharedValue<number>;

/** A numeral that bobs while the chord sounds: the higher its share of the ratio, the quicker. */
function Numeral({ value, styles, swing, rate, accent, testID }: { value: number; styles: Styles; swing: Swing; rate: number; accent?: 'accent' | 'missing'; testID?: string }) {
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
function Wave({ cycles, label, styles, swing, color, muted }: { cycles: number; label: string; styles: Styles; swing: Swing; color: string; muted: string }) {
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

function makeStyles(p: Palette, width: number, digits: number) {
  // Bricolage digits run about 0.58 em wide at this tracking; two gaps sit between the three numerals
  const room = Math.min(width, 440) - 2 * spacing.lg - 2 * spacing.lg;
  const numeralSize = Math.min(type.numeral.fontSize, Math.floor(room / (digits * 0.58)));
  const glow = (color: string) => (Platform.OS === 'web' ? { textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 28 } : { textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 });
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
    waves: { marginTop: spacing.xl, gap: spacing.md },
    waveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    wave: { flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', gap: 3 },
    bar: { flex: 1, height: 28, borderRadius: 2 },
    waveLabel: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted, width: 104 },
    sentence: { fontFamily: fonts.text, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: p.inkSoft, textAlign: 'center', marginTop: spacing.xl, minHeight: type.body.lineHeight * 2 },
    offers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
    offer: { flexBasis: '44%', flexGrow: 1, height: 76, borderRadius: radius.card, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
    offerPressed: { opacity: 0.7 },
    offerWrong: { borderColor: p.wrong, opacity: 0.45 },
    offerText: { fontFamily: fonts.numeral, fontSize: type.offer.fontSize, letterSpacing: type.offer.letterSpacing, color: p.ink },
    offerTextWrong: { color: p.wrong, textDecorationLine: 'line-through' },
    after: { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    listen: { height: 48, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' },
    listenText: { fontFamily: fonts.textMedium, fontSize: 15, color: p.accentInk },
    small: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted, textAlign: 'center' },
    footer: { flexGrow: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.xl },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    boxes: { flexDirection: 'row', gap: 5 },
    box: { width: 14, height: 14, borderRadius: radius.box, backgroundColor: p.trackEmpty },
    boxWrong: { backgroundColor: p.wrong },
    boxSolved: { backgroundColor: p.accent },
    share: { height: 44, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
    shareText: { fontFamily: fonts.textMedium, fontSize: 14, color: p.ink },
  });
}
