import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatWeek, weeklyTrend, WINDOW, windowAverage } from '../coverage';
import type { CoverageRecord } from '../coverage';
import { colors, spacing } from '../theme';

interface Props {
  records: readonly CoverageRecord[];
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Coverage over time: window average and one bar per week. Never a single move's value. */
export function CoverageScreen({ records }: Props) {
  const avg = windowAverage(records);
  const trend = weeklyTrend(records).slice(-12);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Maschinen-Deckung</Text>
      <Text style={styles.explain}>
        Wie viel von dem, was die Engine sieht, siehst du ohne Hilfe? Vor jedem Zug markierst du Felder, die eine erreichbare Harmonie bilden.
        Die Engine gleicht ab. Gezählt wird nur, wenn eine Harmonie erreichbar war.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>Letzte {Math.min(WINDOW, records.length)} gewertete Züge</Text>
        <Text style={styles.big} testID="coverage-average">
          {avg === null ? '–' : pct(avg)}
        </Text>
        <Text style={styles.small}>{records.length} gewertete Züge insgesamt</Text>
      </View>
      <Text style={styles.label}>Verlauf nach Wochen</Text>
      {trend.length === 0 ? <Text style={styles.small}>Noch keine Daten. Spiele mit Anzeige-Stufe 0 bis 2, dann entsteht hier der Trend.</Text> : null}
      {trend.map((w) => (
        <View key={w.weekStart} style={styles.barRow}>
          <Text style={styles.barLabel}>{formatWeek(w.weekStart)}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(w.average * 100)}%` }]} />
          </View>
          <Text style={styles.barValue}>
            {pct(w.average)} · {w.moves}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  explain: { color: colors.muted, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.lg, gap: spacing.xs },
  label: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  big: { fontSize: 40, fontWeight: '700', color: colors.ink },
  small: { color: colors.muted, fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 48, color: colors.muted, fontSize: 12 },
  barTrack: { flex: 1, height: 14, backgroundColor: colors.squareLight, borderRadius: 7, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  barValue: { width: 80, textAlign: 'right', color: colors.ink, fontSize: 12 },
});
