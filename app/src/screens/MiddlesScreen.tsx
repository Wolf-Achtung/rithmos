/**
 * Middles without the board (CLAUDE.md, Stufe 1). One screen: two numbers
 * stand, the middle is missing, the answer is typed, three tries; after each
 * try a line shows what the tip built, and that line teaches the rule. On the
 * right answer the three numbers swing together, the chord sounds, one
 * sentence appears.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { Easing, cancelAnimation, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { meanOf } from '../../../engine/harmony';
import { generateMiddles, isoDate, middlesNumber } from '../../../jobs/src/middles';
import type { Triad } from '../../../jobs/src/middles';
import { apiConfigured, fetchDistribution, fetchNarration, fetchTodayPuzzle, submitAttempt } from '../api/client';
import type { Distribution, Narration, Session } from '../api/client';
import { Gaps, Keypad, Numeral, Offer, PillButton, Wave, intervalLabel, makeTriadStyles } from '../components/Triad';
import { Tuner } from '../components/Tuner';
import { ExplainAsk } from './ExplainAsk';
import type { TunerState } from '../components/Tuner';
import { chordFrequencies } from '../middles/chord';
import { HELP_AFTER, MAX_TRIES, feedbackFor, gapLine, isFinished, patternExample, recordAnswer, shareText, streakOn, triesOf } from '../middles/logic';
import type { DayResult } from '../middles/logic';
import type { SkillRecord } from '../middles/skill';
import { playChord } from '../middles/sound';
import { canTune } from '../middles/tone';
import { judgeRelease } from '../middles/tuning';
import { store } from '../storage';
import { texts, triadSentence } from '../texts';
import { spacing } from '../theme';
import type { Palette } from '../theme';

const RESULTS_KEY = 'middles:results';

interface Props {
  readonly session: Session | null;
  readonly palette: Palette;
  readonly soundOn: boolean;
  readonly onOpenSettings: () => void;
  /** the finished day, for the hit rate per mean; idempotent by id */
  readonly onSkill: (record: SkillRecord) => void;
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
        const { find, ...rest } = puzzle.triad;
        const triad: Triad = find ? { ...rest, find } : rest;
        if (b !== null && triad.options.includes(b)) return { date: puzzle.date, triad, b, source: 'api' };
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

export function MiddlesScreen({ session, palette, soundOn, onOpenSettings, onSkill }: Props) {
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // the three numerals share one line: size them by the digits they need
  const digits = loaded ? String(loaded.triad.a).length + String(loaded.triad.c).length + Math.max(...loaded.triad.options.map((v) => String(v).length)) : 6;
  const styles = useMemo(() => makeTriadStyles(palette, width, digits), [palette, width, digits]);
  const [results, setResults] = useState<DayResult[]>([]);
  const [ready, setReady] = useState(false);
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [narration, setNarration] = useState<Narration | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [live, setLive] = useState<TunerState | null>(null);
  const [typed, setTyped] = useState('');
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

  // the settlement of a finished day: sound, swing, the record, the attempt on the server
  useEffect(() => {
    if (!loaded || !finished || !today || submitted.current) return;
    submitted.current = true;
    if (today.solved) {
      swing.value = withSequence(withTiming(1, { duration: 1800, easing: Easing.linear }), withTiming(0, { duration: 0 }));
      if (soundOn) void playChord(chordFrequencies([loaded.triad.a, loaded.b, loaded.triad.c])).catch(() => undefined);
    }
    onSkill({ id: `daily:${loaded.date}`, t: Date.now(), mode: 'daily', level: 0, kind: loaded.triad.kind, solved: today.solved, tries: triesOf(today), ...(today.cents === undefined ? {} : { cents: today.cents }) });
    if (loaded.source === 'api' && session && lastAnswer !== undefined) {
      const seconds = Math.round((Date.now() - started.current) / 1000);
      submitAttempt(session, loaded.date, { answer: lastAnswer, tries: triesOf(today) }, seconds)
        .then((r) => setDistribution(r.distribution))
        .catch(() => fetchDistribution(loaded.date).then(setDistribution).catch(() => undefined))
        .finally(() => fetchNarration(session, loaded.date).then(setNarration).catch(() => undefined));
    }
    return () => cancelAnimation(swing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, finished]);

  function tap(answer: number) {
    if (!loaded || finished) return;
    const solved = feedbackFor(loaded.triad, answer).kind === 'right';
    const next = recordAnswer(results, loaded.date, answer, solved, undefined, loaded.triad.find?.id);
    setResults(next);
    setTyped('');
    void store.write(RESULTS_KEY, next);
  }

  function enter() {
    const v = Number(typed);
    if (typed.length > 0 && Number.isInteger(v)) tap(v);
  }

  /** The finger is up: right within the lock, the other mean, or off by so many cents. */
  function release(value: number) {
    if (!loaded || finished) return;
    const { triad, b } = loaded;
    const verdict = judgeRelease(value, b, triad.kind, triad.a, triad.c);
    const answer = verdict.kind === 'right' ? b : verdict.kind === 'otherMean' ? verdict.value : Math.round(value * 10) / 10;
    const next = recordAnswer(results, loaded.date, answer, verdict.kind === 'right', verdict.cents, triad.find?.id);
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
      ? (triad.find?.sentence ?? triadSentence(triad.kind, triad.a, b, triad.c, number))
      : texts.triadRevealed(b)
    : feedback?.kind === 'otherMean'
      ? texts.triadOtherMean(lastAnswer!, feedback.mean)
      : feedback?.kind === 'wrong'
        ? Number.isInteger(lastAnswer)
          ? texts.triadWrong(lastAnswer!)
          : texts.triadOff(lastAnswer!)
        : texts.triadQuestion(patternExample(triad.kind, triad.a, triad.c));
  const tuning = canTune && soundOn && !finished;
  const helped = tries >= HELP_AFTER;
  const gaps = finished ? gapLine(triad.kind, triad.a, b, triad.c) : lastAnswer !== undefined ? gapLine(triad.kind, triad.a, lastAnswer, triad.c) : null;
  // the last tip stays in the middle until the next one is typed: the gap line explains it
  const shown = typed.length > 0 ? typed : lastAnswer !== undefined ? String(lastAnswer).replace('.', ',') : '?';
  const showingLast = typed.length === 0 && lastAnswer !== undefined;

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

      {triad.find && !finished ? (
        <Text style={[styles.small, { marginTop: spacing.lg }]} testID="middles-find-lead">
          {texts.findLine(triad.find.title, triad.find.where)}
        </Text>
      ) : null}

      <View style={styles.numbers} testID="middles-numbers">
        <Numeral value={triad.a} styles={styles} swing={swing} rate={1} />
        {finished ? (
          <Numeral value={b} styles={styles} swing={swing} rate={b / triad.a} accent={solved ? 'accent' : 'missing'} testID="middles-answer" />
        ) : (
          <Text style={[styles.numeral, styles.numeralMissing, showingLast && styles.numeralWrong, live && styles.numeralLive]} testID="middles-missing">
            {live ? '♪' : shown}
          </Text>
        )}
        <Numeral value={triad.c} styles={styles} swing={swing} rate={triad.c / triad.a} />
      </View>

      {gaps ? <Gaps line={gaps} styles={styles} testID="middles-gaps" /> : <View style={styles.gaps} />}

      <View style={styles.waves}>
        <Wave cycles={1} label={String(triad.a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
        <Wave cycles={finished ? b / triad.a : 0} label={finished ? intervalLabel(b, triad.a) : '?'} styles={styles} swing={swing} color={solved ? palette.accent : palette.missing} muted={palette.muted} />
        <Wave cycles={triad.c / triad.a} label={intervalLabel(triad.c, triad.a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
      </View>

      <Text style={styles.sentence} testID="middles-sentence">
        {sentence}
      </Text>

      {!finished && !helped ? <Keypad value={typed} onChange={setTyped} onEnter={enter} enterLabel={texts.keypadEnter} styles={styles} testID="middles-keypad" /> : null}
      {!finished && helped ? (
        <View style={styles.offers} testID="middles-offers">
          {triad.options.map((v) => (
            <Offer key={v} label={String(v)} onPress={() => tap(v)} state={today?.answers.includes(v) ? 'wrong' : 'open'} styles={styles} testID={`offer-${v}`} />
          ))}
        </View>
      ) : null}
      {tuning ? <Tuner a={triad.a} c={triad.c} palette={palette} soundOn={soundOn} onChange={setLive} onRelease={release} testID="middles-tuner" /> : null}
      {finished ? (
        <View style={styles.after}>
          {triad.find ? (
            <Pressable onPress={() => void Linking.openURL(triad.find!.source).catch(() => undefined)} testID="middles-find" hitSlop={8}>
              <Text style={styles.small}>
                {texts.findLine(triad.find.title, triad.find.where)} · <Text style={{ color: palette.accent }}>{texts.findSource}</Text>
              </Text>
            </Pressable>
          ) : null}
          <PillButton label={texts.triadListen} onPress={listen} styles={styles} testID="middles-listen" />
          {distribution ? (
            <Text style={styles.small} testID="middles-distribution">
              {texts.triadDistribution(distribution.attempts, distribution.solved)}
            </Text>
          ) : null}
          {loaded.source === 'local' ? <Text style={styles.small}>{texts.triadOffline}</Text> : null}
          {loaded.source === 'api' && session ? <ExplainAsk session={session} date={loaded.date} palette={palette} /> : null}
          {narration ? (
            <View style={styles.voices} testID="middles-narration">
              <Text style={styles.voice}>
                <Text style={styles.voiceName}>{texts.voiceMonk} </Text>
                {narration.monk}
              </Text>
              <Text style={styles.voice}>
                <Text style={styles.voiceName}>{texts.voiceAnalyst} </Text>
                {narration.analyst}
              </Text>
              <Text style={[styles.small, { marginTop: 8 }]}>{picked === null ? texts.whoLiesQuestion : picked === narration.truth ? texts.whoLiesRight : texts.whoLiesWrong(narration.truth)}</Text>
              {narration.statements.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => picked === null && setPicked(i)}
                  disabled={picked !== null}
                  testID={`statement-${i}`}
                  style={[styles.statement, picked !== null && i === narration.truth && styles.statementTrue, picked === i && i !== narration.truth && styles.statementLie]}
                >
                  <Text style={styles.statementText}>{s}</Text>
                </Pressable>
              ))}
              <Text style={styles.aiLabel}>{texts.aiLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

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
        {finished ? <PillButton label={shareNote ?? texts.triadShare} onPress={share} styles={styles} testID="middles-share" outline /> : null}
      </View>
    </ScrollView>
  );
}
