/**
 * The Middles form of the coverage metric (CLAUDE.md 7): hit rate per mean
 * over the last fifty puzzles, and the trend over weeks. Numbers, not a
 * score; the lagging mean is named because the practice pulls it forward.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HARMONY_KINDS } from '../../../engine/harmony';
import { unlockedLevel } from '../../../jobs/src/practice';
import { formatWeek } from '../coverage';
import { hitRates, solvedAtLevel, weakestKind, weeklyHitTrend } from '../middles/skill';
import { weeklyTrend, windowAverage } from '../coverage';
import type { CoverageRecord } from '../coverage';
import type { SkillRecord } from '../middles/skill';
import { kindName, patternName, texts } from '../texts';
import { fonts, radius, spacing, type } from '../theme';
import type { Palette } from '../theme';

interface Props {
  readonly palette: Palette;
  readonly records: readonly SkillRecord[];
  /** markings on the board (Stufe 5) */
  readonly coverage?: readonly CoverageRecord[];
}

export function SkillScreen({ palette, records, coverage = [] }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const rates = hitRates(records);
  const weeks = weeklyHitTrend(records).slice(-8);
  const lagging = weakestKind(records);
  const level = unlockedLevel((l) => solvedAtLevel(records, l));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="skill">
      <Text style={styles.brand}>{texts.skillTitle}</Text>
      <Text style={styles.intro}>{texts.skillIntro}</Text>

      <View style={styles.rates}>
        {rates.map((r) => (
          <View key={r.kind} style={styles.rateRow} testID={`skill-${r.kind}`}>
            <View style={styles.rateHead}>
              <Text style={styles.kind}>
                {kindName[r.kind]} <Text style={styles.small}>{patternName[r.kind]}</Text>
              </Text>
              <Text style={styles.rateText}>{r.rate === null ? texts.skillNone : texts.skillRate(Math.round(r.rate * r.n), r.n)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((r.rate ?? 0) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.small}>{lagging && records.length > 0 ? texts.skillLagging(lagging) : texts.skillLevel(level)}</Text>
      {lagging && records.length > 0 ? <Text style={styles.small}>{texts.skillLevel(level)}</Text> : null}

      <Text style={styles.section}>{texts.skillBoardTitle}</Text>
      {(() => {
        const avg = windowAverage(coverage);
        const weeks = weeklyTrend(coverage).slice(-6);
        return avg === null ? (
          <Text style={styles.small}>{texts.skillBoardNone}</Text>
        ) : (
          <View style={styles.rateRow} testID="skill-board">
            <View style={styles.rateHead}>
              <Text style={styles.small}>{texts.skillBoardLabel}</Text>
              <Text style={styles.rateText}>{texts.skillBoardAverage(Math.round(avg * 100), Math.min(coverage.length, 50))}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(avg * 100)}%` }]} />
            </View>
            <Text style={styles.small}>{weeks.map((w) => `${formatWeek(w.weekStart)}: ${Math.round(w.average * 100)} %`).join(' · ')}</Text>
          </View>
        );
      })()}

      <Text style={styles.section}>{texts.skillWeeks}</Text>
      {weeks.length === 0 ? (
        <Text style={styles.small}>{texts.skillNoWeeks}</Text>
      ) : (
        <View style={styles.weeks}>
          <View style={styles.weekRow}>
            <Text style={[styles.weekLabel, styles.weekHead]} />
            {HARMONY_KINDS.map((k) => (
              <Text key={k} style={[styles.weekCell, styles.weekHead]}>
                {kindName[k].slice(0, 4)}.
              </Text>
            ))}
          </View>
          {weeks.map((w) => (
            <View key={w.weekStart} style={styles.weekRow}>
              <Text style={styles.weekLabel}>{texts.skillWeekRow(formatWeek(w.weekStart))}</Text>
              {HARMONY_KINDS.map((k) => {
                const b = w.byKind[k];
                return (
                  <Text key={k} style={styles.weekCell}>
                    {b.n === 0 ? '·' : `${Math.round((b.solved / b.n) * 100)} %`}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.background },
    container: { flexGrow: 1, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
    brand: { fontFamily: fonts.numeralBold, fontSize: type.title.fontSize, letterSpacing: type.title.letterSpacing, color: p.ink },
    intro: { fontFamily: fonts.text, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: p.inkSoft },
    rates: { gap: spacing.lg, marginTop: spacing.lg },
    rateRow: { gap: spacing.sm },
    rateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    kind: { fontFamily: fonts.numeral, fontSize: 24, letterSpacing: -0.5, color: p.ink },
    rateText: { fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted },
    track: { height: 10, borderRadius: radius.pill, backgroundColor: p.trackEmpty, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: p.accent, borderRadius: radius.pill },
    small: { fontFamily: fonts.text, fontSize: type.small.fontSize, lineHeight: type.small.lineHeight, color: p.muted },
    section: { fontFamily: fonts.textMedium, fontSize: type.small.fontSize, color: p.muted, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.lg },
    weeks: { gap: spacing.xs },
    weekRow: { flexDirection: 'row', alignItems: 'center' },
    weekLabel: { flex: 1.4, fontFamily: fonts.text, fontSize: type.small.fontSize, color: p.muted },
    weekCell: { flex: 1, fontFamily: fonts.numeral, fontSize: 15, color: p.ink, textAlign: 'right' },
    weekHead: { fontFamily: fonts.text, color: p.muted, fontSize: type.small.fontSize },
  });
}
