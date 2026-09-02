/**
 * The chain (CLAUDE.md, Zug D): twelve numbers, laid into a chain where every
 * three in a row form a harmony. Constructive, not asked: the player builds.
 * Generated on the device, the longest chain known from search; the reached
 * length is the day's score.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Easing, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { HarmonyKind } from '../../../engine/harmony';
import { canLay, chainShareText, generateChain, linkKind } from '../../../jobs/src/chain';
import type { ChainPuzzle } from '../../../jobs/src/chain';
import { isoDate, middlesNumber } from '../../../jobs/src/middles';
import { Gaps, Numeral, PillButton, makeTriadStyles } from '../components/Triad';
import { gapLine } from '../middles/logic';
import { chordFrequencies } from '../middles/chord';
import { playChord } from '../middles/sound';
import { store } from '../storage';
import { patternShort, texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

const CHAIN_KEY = 'middles:chain';

interface Props {
  readonly palette: Palette;
  readonly soundOn: boolean;
}

/** The day, as stored: the best length reached and whether it was revealed. */
interface ChainDay {
  readonly date: string;
  readonly reached: number;
  readonly revealed: boolean;
}

export function ChainScreen({ palette, soundOn }: Props) {
  const { width } = useWindowDimensions();
  const puzzle: ChainPuzzle = useMemo(() => generateChain(isoDate(Date.now())), []);
  const [chain, setChain] = useState<number[]>([]);
  const [days, setDays] = useState<ChainDay[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const swing = useSharedValue(0);
  const digits = Math.max(...puzzle.numbers.map((n) => String(n).length));
  const styles = useMemo(() => makeTriadStyles(palette, width, digits * 4, 4), [palette, width, digits]);
  const own = useMemo(() => makeStyles(palette), [palette]);

  useEffect(() => {
    let alive = true;
    void store.read<ChainDay[]>(CHAIN_KEY, []).then((d) => alive && setDays(d));
    return () => {
      alive = false;
    };
  }, []);

  const today = days.find((d) => d.date === puzzle.date);
  const reached = Math.max(today?.reached ?? 0, chain.length);
  const stuck = chain.length >= 2 && !puzzle.numbers.some((n) => !chain.includes(n) && canLay(chain, n));
  const done = reached >= puzzle.best;

  function remember(patch: Partial<ChainDay>) {
    setDays((prev) => {
      const current = prev.find((d) => d.date === puzzle.date) ?? { date: puzzle.date, reached: 0, revealed: false };
      const next = [...prev.filter((d) => d.date !== puzzle.date), { ...current, ...patch, reached: Math.max(current.reached, patch.reached ?? 0) }];
      void store.write(CHAIN_KEY, next);
      return next;
    });
  }

  function lay(n: number) {
    if (chain.includes(n) || !canLay(chain, n)) return;
    const next = [...chain, n];
    setChain(next);
    remember({ reached: next.length });
    if (next.length >= 3) {
      swing.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900, easing: Easing.linear }), withTiming(0, { duration: 0 }));
      const [a, b, c] = next.slice(-3) as [number, number, number];
      if (soundOn) void playChord(chordFrequencies([a, b, c])).catch(() => undefined);
    }
  }

  function reset() {
    setChain([]);
  }

  function reveal() {
    remember({ revealed: true });
    setChain([...puzzle.solution]);
  }

  async function share() {
    try {
      await Share.share({ message: chainShareText(puzzle.date, reached, puzzle.best) });
    } catch {
      setShareNote(texts.triadCopied);
      const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator?.clipboard;
      await clipboard?.writeText(chainShareText(puzzle.date, reached, puzzle.best)).catch(() => undefined);
    }
  }

  const number = middlesNumber(puzzle.date);
  const sentence = today?.revealed
    ? texts.chainRevealed(puzzle.solution)
    : done
      ? texts.chainDone(puzzle.best)
      : stuck
        ? texts.chainStuck(chain.length, puzzle.best)
        : chain.length === 0
          ? texts.chainQuestion
          : texts.chainLinks(chain.length, puzzle.best);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="chain">
      <View style={styles.header}>
        <Text style={styles.brand}>{texts.chain}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta}>{texts.triadNumber(number)}</Text>
          <View style={styles.dot} />
          <Text style={[styles.headerMeta, { color: palette.accent }]} testID="chain-score">
            {reached}/{puzzle.best}
          </Text>
        </View>
      </View>

      <View style={own.laid} testID="chain-laid">
        {chain.length === 0 ? (
          <Text style={[styles.numeral, styles.numeralMissing]}>?</Text>
        ) : (
          chain.map((n, i) => {
            const kind: HarmonyKind | null = i >= 2 ? linkKind(chain.slice(0, i), n) : null;
            return (
              <View key={n} style={own.link}>
                <Numeral value={n} styles={styles} swing={swing} rate={n / chain[0]!} accent={i >= 2 ? 'accent' : undefined} />
                {kind ? <Text style={own.kind}>{patternShort[kind]}</Text> : <Text style={own.kind}> </Text>}
              </View>
            );
          })
        )}
      </View>

      {chain.length >= 3 ? (() => {
        const [a, b, c] = chain.slice(-3) as [number, number, number];
        const kind = linkKind(chain.slice(0, -1), c);
        return kind ? <Gaps line={gapLine(kind, a, b, c)} styles={styles} testID="chain-gaps" /> : null;
      })() : <View style={styles.gaps} />}

      <Text style={styles.sentence} testID="chain-sentence">
        {sentence}
      </Text>

      <View style={own.grid} testID="chain-grid">
        {puzzle.numbers.map((n) => {
          const laid = chain.includes(n);
          const open = !laid && canLay(chain, n);
          return (
            <Pressable key={n} onPress={() => lay(n)} disabled={laid || !open} testID={`stone-${n}`} style={({ pressed }) => [own.stone, laid && own.stoneLaid, !laid && !open && own.stoneOut, pressed && open && styles.pressed]}>
              <Text style={[own.stoneText, laid && own.stoneTextLaid, !laid && !open && own.stoneTextOut]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {chain.length > 0 ? <PillButton label={texts.chainReset} onPress={reset} styles={styles} testID="chain-reset" outline /> : null}
          {!today?.revealed && !done ? <PillButton label={texts.chainReveal} onPress={reveal} styles={styles} testID="chain-reveal" outline /> : null}
        </View>
        {reached > 0 ? <PillButton label={shareNote ?? texts.triadShare} onPress={share} styles={styles} testID="chain-share" outline /> : null}
      </View>
    </ScrollView>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    laid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.xl, minHeight: 120 },
    link: { alignItems: 'center' },
    kind: { fontFamily: fonts.text, fontSize: 11, color: p.muted, letterSpacing: 0.5, height: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
    stone: { flexBasis: '22%', flexGrow: 1, height: 64, borderRadius: radius.card, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
    stoneLaid: { backgroundColor: p.accent, borderColor: p.accent },
    stoneOut: { opacity: 0.35 },
    stoneText: { fontFamily: fonts.numeral, fontSize: type.offer.fontSize - 6, letterSpacing: type.offer.letterSpacing, color: p.ink },
    stoneTextLaid: { color: p.accentInk },
    stoneTextOut: { color: p.muted },
  });
}
