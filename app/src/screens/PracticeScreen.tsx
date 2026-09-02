/**
 * Practice (CLAUDE.md, Stufe 2): the progression beside the daily puzzle.
 * Five levels, one puzzle after another, every result feeding the hit rate
 * per mean. Same picture as the daily: numerals, waves, offers.
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Easing, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { HARMONY_KINDS } from '../../../engine/harmony';
import type { HarmonyKind } from '../../../engine/harmony';
import { choosePracticeLevel, generatePractice, practiceKind, practiceSeed, unlockedLevel, UNLOCK_AFTER } from '../../../jobs/src/practice';
import type { PracticePuzzle } from '../../../jobs/src/practice';
import { Gaps, Keypad, Numeral, Offer, PillButton, Wave, intervalLabel, makeTriadStyles } from '../components/Triad';
import { Lengths } from '../components/Lengths';
import { Tuner } from '../components/Tuner';
import type { TunerState } from '../components/Tuner';
import type { Swing, TriadStyles } from '../components/Triad';
import { chordFrequencies } from '../middles/chord';
import { HELP_AFTER, MAX_TRIES, feedbackFor, gapLine, patternExample } from '../middles/logic';
import { solvedAtLevel, weakestKind } from '../middles/skill';
import type { SkillRecord } from '../middles/skill';
import { playChord } from '../middles/sound';
import { canTune } from '../middles/tone';
import { judgeLength, judgeRelease } from '../middles/tuning';
import { texts, triadSentence } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly palette: Palette;
  readonly soundOn: boolean;
  readonly records: readonly SkillRecord[];
  readonly onSkill: (record: SkillRecord) => void;
}

/** The sense an answer comes through (CLAUDE.md 2, andere Sinne): typed, drawn as a length, or tuned by ear. */
type Sense = 'number' | 'length' | 'tone';
const SENSES: readonly Sense[] = ['number', 'length', 'tone'];

/** What the player did on the current puzzle: taps in order. */
interface Round {
  readonly puzzle: PracticePuzzle;
  readonly count: number;
  readonly taps: readonly (number | HarmonyKind)[];
  readonly solved: boolean;
  readonly finished: boolean;
  /** deviation of the last released tone, in cents; absent when tapped */
  readonly cents?: number;
}

const WHICH_TRIES = 2;

function maxTries(p: PracticePuzzle): number {
  return p.form === 'which' ? WHICH_TRIES : MAX_TRIES;
}

function nextRound(records: readonly SkillRecord[]): Round {
  const count = records.filter((r) => r.mode === 'practice').length;
  const unlocked = unlockedLevel((level) => solvedAtLevel(records, level));
  const level = choosePracticeLevel(unlocked, weakestKind(records), count);
  return { puzzle: generatePractice(level, practiceSeed(count), count), count, taps: [], solved: false, finished: false };
}

function applyTap(round: Round, tap: number | HarmonyKind): Round {
  const { puzzle } = round;
  const taps = [...round.taps, tap];
  const wrong = taps.filter((t) => !isRight(puzzle, t)).length;
  let solved = false;
  if (puzzle.form === 'triad') solved = typeof tap === 'number' && feedbackFor(puzzle.triad, tap).kind === 'right';
  if (puzzle.form === 'which') solved = tap === puzzle.kind;
  if (puzzle.form === 'four') solved = puzzle.answers.every((a) => taps.includes(a));
  return { ...round, taps, solved, finished: solved || wrong >= maxTries(puzzle) };
}

/** A released length on a triad round: the answer it stands for, judged by eye. */
function applyLength(round: Round, value: number): Round {
  const { puzzle } = round;
  if (puzzle.form !== 'triad') return round;
  const { a, c, kind } = puzzle.triad;
  const verdict = judgeLength(value, puzzle.b, kind, a, c);
  const answer = verdict.kind === 'right' ? puzzle.b : verdict.kind === 'otherMean' ? verdict.value : Math.round(value * 10) / 10;
  return applyTap(round, answer);
}

/** A released tone on a triad round: the answer it stands for, and its deviation. */
function applyRelease(round: Round, value: number): Round {
  const { puzzle } = round;
  if (puzzle.form !== 'triad') return round;
  const { a, c, kind } = puzzle.triad;
  const verdict = judgeRelease(value, puzzle.b, kind, a, c);
  const answer = verdict.kind === 'right' ? puzzle.b : verdict.kind === 'otherMean' ? verdict.value : Math.round(value * 10) / 10;
  return { ...applyTap(round, answer), cents: verdict.cents };
}

function isRight(p: PracticePuzzle, tap: number | HarmonyKind): boolean {
  if (p.form === 'triad') return tap === p.b;
  if (p.form === 'which') return tap === p.kind;
  return typeof tap === 'number' && p.answers.includes(tap);
}

export function PracticeScreen({ palette, soundOn, records, onSkill }: Props) {
  const { width } = useWindowDimensions();
  const [round, setRound] = useState<Round>(() => nextRound(records));
  const { puzzle } = round;
  const slots = puzzle.form === 'four' ? 4 : 3;
  const digits = useMemo(() => digitsOf(puzzle), [puzzle]);
  const styles = useMemo(() => makeTriadStyles(palette, width, digits, slots), [palette, width, digits, slots]);
  const swing = useSharedValue(0);
  const [live, setLive] = useState<TunerState | null>(null);
  const [typed, setTyped] = useState('');
  const [sense, setSense] = useState<Sense>('number');
  const own = useMemo(() => makeOwnStyles(palette), [palette]);

  const values = useMemo(() => valuesOf(puzzle), [puzzle]);
  const chord = useMemo(() => chordFrequencies([values[0]!, values[1]!, values[2]!]).concat(values.slice(3).map((v) => (220 * v) / values[0]!)), [values]);

  // settlement: sound, swing, the record
  useEffect(() => {
    if (!round.finished) return;
    if (round.solved) {
      swing.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1800, easing: Easing.linear }), withTiming(0, { duration: 0 }));
      if (soundOn) void playChord(chord).catch(() => undefined);
    }
    const wrong = round.taps.filter((t) => !isRight(puzzle, t)).length;
    const via: SkillRecord['sense'] = round.cents !== undefined ? 'tone' : sense === 'length' && puzzle.form === 'triad' ? 'length' : undefined;
    onSkill({ id: `practice:${round.count}`, t: Date.now(), mode: 'practice', level: puzzle.level, kind: practiceKind(puzzle), solved: round.solved, tries: wrong + 1, ...(round.cents === undefined ? {} : { cents: round.cents }), ...(via ? { sense: via } : {}), ...(puzzle.form === 'triad' && puzzle.triad.find ? { find: puzzle.triad.find.id } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.finished]);

  function tap(t: number | HarmonyKind) {
    if (round.finished) return;
    setTyped('');
    setRound(applyTap(round, t));
  }

  function enter() {
    const v = Number(typed);
    if (typed.length > 0 && Number.isInteger(v)) tap(v);
  }

  function release(value: number) {
    if (round.finished) return;
    setRound(applyRelease(round, value));
  }

  function releaseLength(value: number) {
    if (round.finished) return;
    setRound(applyLength(round, value));
  }

  function next() {
    setLive(null);
    setTyped('');
    setRound(nextRound(records));
  }

  const senses = SENSES.filter((x) => x === 'number' || (puzzle.form === 'triad' && (x === 'length' || (canTune && soundOn))));
  const active: Sense = senses.includes(sense) ? sense : 'number';
  const tuning = active === 'tone' && canTune && soundOn && !round.finished && puzzle.form === 'triad';
  const byLength = active === 'length' && puzzle.form === 'triad' && !round.finished;
  // by length the numbers stay hidden until the first try: the eye decides, the feedback shows the numbers
  const numbersHidden = byLength && round.taps.length === 0;

  const wrongTaps = round.taps.filter((t) => !isRight(puzzle, t)).length;
  const helped = puzzle.form !== 'triad' || wrongTaps >= HELP_AFTER;
  const unlocked = unlockedLevel((level) => solvedAtLevel(records, level));
  const remaining = unlocked < 5 ? Math.max(0, UNLOCK_AFTER - solvedAtLevel(records, unlocked)) : 0;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="practice">
      <View style={styles.header}>
        <Text style={styles.brand}>{texts.practice}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta} testID="practice-level">
            {texts.practiceLevel(puzzle.level)}
          </Text>
          <View style={styles.dot} />
          <Text style={[styles.headerMeta, { color: palette.accent }]}>{texts.practiceLevelName[puzzle.level - 1]}</Text>
        </View>
      </View>

      {senses.length > 1 ? (
        <View style={own.senses} testID="practice-senses">
          {senses.map((x) => (
            <Pressable key={x} onPress={() => setSense(x)} style={[own.sense, x === active && own.senseActive]} testID={`sense-${x}`}>
              <Text style={[own.senseLabel, x === active && own.senseLabelActive]}>{texts.senseName[x]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {puzzle.form === 'triad' && puzzle.triad.find && !round.finished ? (
        <Text style={[styles.small, { marginTop: spacing.md }]} testID="practice-find-lead">
          {texts.findLine(puzzle.triad.find.title, puzzle.triad.find.where)}
        </Text>
      ) : null}
      {puzzle.form === 'triad' && !numbersHidden ? <TriadRound round={round} styles={styles} swing={swing} palette={palette} live={live} typed={typed} /> : null}
      {puzzle.form === 'which' ? <WhichRound round={round} styles={styles} swing={swing} palette={palette} /> : null}
      {puzzle.form === 'four' ? <FourRound round={round} styles={styles} swing={swing} palette={palette} /> : null}

      <Text style={styles.sentence} testID="practice-sentence">
        {numbersHidden ? texts.lengthQuestion : sentenceFor(round)}
      </Text>

      {byLength && !helped ? (
        <Lengths key={round.count} a={puzzle.triad.a} c={puzzle.triad.c} example={patternExample(puzzle.triad.kind, puzzle.triad.a, puzzle.triad.c)} palette={palette} onChange={() => undefined} onRelease={releaseLength} testID="practice-lengths" />
      ) : null}
      {!round.finished && !helped && active === 'number' ? <Keypad value={typed} onChange={setTyped} onEnter={enter} enterLabel={texts.keypadEnter} styles={styles} testID="practice-keypad" /> : null}
      {!round.finished && helped ? (
        <View style={styles.offers} testID="practice-offers">
          {puzzle.form === 'which'
            ? HARMONY_KINDS.map((k) => (
                <Offer key={k} label={texts.whichOffer(k, patternExample(k, puzzle.values[0], puzzle.values[2]))} onPress={() => tap(k)} state={round.taps.includes(k) ? 'wrong' : 'open'} styles={styles} testID={`offer-${k}`} wide />
              ))
            : (puzzle.form === 'triad' ? puzzle.triad.options : puzzle.options).map((v) => (
                <Offer key={v} label={String(v)} onPress={() => tap(v)} state={round.taps.includes(v) ? (isRight(puzzle, v) ? 'right' : 'wrong') : 'open'} styles={styles} testID={`offer-${v}`} />
              ))}
        </View>
      ) : null}
      {tuning && puzzle.form === 'triad' && !helped ? <Tuner a={puzzle.triad.a} c={puzzle.triad.c} palette={palette} soundOn={soundOn} onChange={setLive} onRelease={release} testID="practice-tuner" /> : null}
      {round.finished ? (
        <View style={styles.after}>
          {puzzle.form === 'triad' && puzzle.triad.find ? (
            <Pressable onPress={() => void Linking.openURL(puzzle.triad.find!.source).catch(() => undefined)} testID="practice-find" hitSlop={8}>
              <Text style={styles.small}>
                {texts.findLine(puzzle.triad.find.title, puzzle.triad.find.where)} · <Text style={{ color: palette.accent }}>{texts.findSource}</Text>
              </Text>
            </Pressable>
          ) : null}
          <PillButton label={texts.next} onPress={next} styles={styles} testID="practice-next" />
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.boxes}>
            {Array.from({ length: maxTries(puzzle) }, (_, i) => {
              const used = i < wrongTaps + (round.solved ? 1 : 0);
              const isSolve = round.solved && i === wrongTaps;
              return <View key={i} style={[styles.box, used && (isSolve ? styles.boxSolved : styles.boxWrong)]} />;
            })}
          </View>
          <Text style={styles.small} testID="practice-progress">
            {unlocked < 5 ? texts.practiceUnlock(remaining, unlocked + 1) : texts.practiceAllOpen}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function digitsOf(p: PracticePuzzle): number {
  const len = (v: number) => String(v).length;
  if (p.form === 'triad') return len(p.triad.a) + len(p.triad.c) + Math.max(...p.triad.options.map(len));
  if (p.form === 'which') return p.values.reduce((s, v) => s + len(v), 0);
  return len(p.a) + len(p.d) + 2 * Math.max(...p.options.map(len));
}

function valuesOf(p: PracticePuzzle): number[] {
  if (p.form === 'triad') return [p.triad.a, p.b, p.triad.c];
  if (p.form === 'which') return [...p.values];
  return [p.a, p.answers[0], p.answers[1], p.d];
}

function sentenceFor(round: Round): string {
  const { puzzle, taps, solved, finished } = round;
  const last = taps[taps.length - 1];
  if (puzzle.form === 'triad') {
    const { a, c, kind } = puzzle.triad;
    if (finished) return solved ? (puzzle.triad.find?.sentence ?? triadSentence(kind, a, puzzle.b, c, round.count)) : texts.triadRevealed(puzzle.b);
    if (typeof last !== 'number') return texts.triadQuestion(patternExample(kind, a, c));
    const f = feedbackFor(puzzle.triad, last);
    return f.kind === 'otherMean' ? texts.triadOtherMean(last, f.mean) : Number.isInteger(last) ? texts.triadWrong(last) : texts.triadOff(last);
  }
  if (puzzle.form === 'which') {
    const [a, b, c] = puzzle.values;
    if (finished) return solved ? texts.whichSolved(b, a, c, puzzle.kind) : texts.whichRevealed(puzzle.kind);
    return typeof last === 'string' ? texts.whichWrong(last) : texts.whichQuestion;
  }
  const [hm, am] = puzzle.answers;
  if (finished) return solved ? texts.fourSolved(puzzle.a, hm, am, puzzle.d) : texts.fourRevealed(hm, am);
  if (typeof last !== 'number') return texts.fourQuestion;
  if (last === hm) return texts.fourOne(last, 'musical');
  if (last === am) return texts.fourOne(last, 'arithmetic');
  return texts.fourWrong(last);
}

type RoundProps = { round: Round; styles: TriadStyles; swing: Swing; palette: Palette; live?: TunerState | null; typed?: string };

function TriadRound({ round, styles, swing, palette, live, typed }: RoundProps) {
  const p = round.puzzle;
  if (p.form !== 'triad') return null;
  const { a, c, kind } = p.triad;
  const { finished, solved } = round;
  const last = round.taps[round.taps.length - 1];
  const gaps = finished ? gapLine(kind, a, p.b, c) : typeof last === 'number' ? gapLine(kind, a, last, c) : null;
  return (
    <>
      <View style={styles.numbers}>
        <Numeral value={a} styles={styles} swing={swing} rate={1} />
        {finished ? (
          <Numeral value={p.b} styles={styles} swing={swing} rate={p.b / a} accent={solved ? 'accent' : 'missing'} />
        ) : (
          <Text style={[styles.numeral, styles.numeralMissing, !typed && typeof last === 'number' && styles.numeralWrong, live && styles.numeralLive]}>{live ? '♪' : typed ? typed : typeof last === 'number' ? String(last).replace('.', ',') : '?'}</Text>
        )}
        <Numeral value={c} styles={styles} swing={swing} rate={c / a} />
      </View>
      {gaps ? <Gaps line={gaps} styles={styles} testID="practice-gaps" /> : <View style={styles.gaps} />}
      <View style={styles.waves}>
        <Wave cycles={1} label={String(a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
        <Wave cycles={finished ? p.b / a : 0} label={finished ? intervalLabel(p.b, a) : '?'} styles={styles} swing={swing} color={solved ? palette.accent : palette.missing} muted={palette.muted} />
        <Wave cycles={c / a} label={intervalLabel(c, a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
      </View>
    </>
  );
}

function WhichRound({ round, styles, swing, palette }: RoundProps) {
  const p = round.puzzle;
  if (p.form !== 'which') return null;
  const [a, b, c] = p.values;
  return (
    <>
      <View style={styles.numbers}>
        <Numeral value={a} styles={styles} swing={swing} rate={1} />
        <Numeral value={b} styles={styles} swing={swing} rate={b / a} accent={round.finished ? (round.solved ? 'accent' : 'missing') : undefined} />
        <Numeral value={c} styles={styles} swing={swing} rate={c / a} />
      </View>
      <View style={styles.waves}>
        {p.values.map((v) => (
          <Wave key={v} cycles={v / a} label={intervalLabel(v, a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
        ))}
      </View>
    </>
  );
}

function FourRound({ round, styles, swing, palette }: RoundProps) {
  const p = round.puzzle;
  if (p.form !== 'four') return null;
  const [hm, am] = p.answers;
  const show = (v: number) => round.finished || round.taps.includes(v);
  const slot = (v: number, key: string) =>
    show(v) ? (
      <Numeral key={key} value={v} styles={styles} swing={swing} rate={v / p.a} accent={round.solved || round.taps.includes(v) ? 'accent' : 'missing'} />
    ) : (
      <Text key={key} style={[styles.numeral, styles.numeralMissing]}>
        ?
      </Text>
    );
  const waveFor = (v: number) => (show(v) ? { cycles: v / p.a, label: intervalLabel(v, p.a), color: round.solved || round.taps.includes(v) ? palette.accent : palette.missing } : { cycles: 0, label: '?', color: palette.missing });
  return (
    <>
      <View style={styles.numbers}>
        <Numeral value={p.a} styles={styles} swing={swing} rate={1} />
        {slot(hm, 'hm')}
        {slot(am, 'am')}
        <Numeral value={p.d} styles={styles} swing={swing} rate={p.d / p.a} />
      </View>
      <View style={styles.waves}>
        <Wave cycles={1} label={String(p.a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
        <Wave {...waveFor(hm)} styles={styles} swing={swing} muted={palette.muted} />
        <Wave {...waveFor(am)} styles={styles} swing={swing} muted={palette.muted} />
        <Wave cycles={p.d / p.a} label={intervalLabel(p.d, p.a)} styles={styles} swing={swing} color={palette.accent} muted={palette.muted} />
      </View>
    </>
  );
}

function makeOwnStyles(p: Palette) {
  return StyleSheet.create({
    senses: { flexDirection: 'row', alignSelf: 'center', marginTop: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: p.border, overflow: 'hidden' },
    sense: { paddingHorizontal: 14, paddingVertical: 6 },
    senseActive: { backgroundColor: p.accent },
    senseLabel: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.muted },
    senseLabelActive: { color: p.accentInk },
  });
}
