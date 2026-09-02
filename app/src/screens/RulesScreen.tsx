import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { harmonyApplications } from '../../../engine/rules/applications';
import { mebben } from '../../../engine/rules/mebben';
import type { SimpleShape } from '../../../engine/types';
import { kindName } from '../texts';
import { movementWording } from './rulesText';
import { colors, spacing } from '../theme';

const shapeName: Record<SimpleShape, string> = { round: 'Runde', triangle: 'Dreieck', square: 'Quadrat' };
const directionName = { orthogonal: 'gerade, nicht diagonal', diagonal: 'ausschließlich diagonal', all: 'alle Richtungen' } as const;

const white = mebben.setup.white.pyramid!.components.map((c) => c.value);
const black = mebben.setup.black.pyramid!.components.map((c) => c.value);

/** The rule set in use, named with its source, built from the data in engine/rules. */
export function RulesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{mebben.name}</Text>
      <Text style={styles.explain}>Quelle: {mebben.source}</Text>
      <Text style={styles.explain}>
        Brett {mebben.board.files} × {mebben.board.ranks}. Weiße Pyramide {white.reduce((a, b) => a + b, 0)} aus {white.join(' + ')}. Schwarze Pyramide{' '}
        {black.reduce((a, b) => a + b, 0)} aus {black.join(' + ')}.
      </Text>

      <Section title="Zugweiten">
        <Text style={styles.explain}>Mebben zählt Start- und Zielfeld mit. „Ins zweite Feld" heißt ein Schritt.</Text>
        {(Object.keys(mebben.movement) as SimpleShape[]).map((shape) => {
          const m = mebben.movement[shape];
          return (
            <Row key={shape} a={shapeName[shape]} b={movementWording(m)} c={`${m.steps} ${m.steps === 1 ? 'Schritt' : 'Schritte'}, ${directionName[m.directions]}`} />
          );
        })}
        <Row a="Pyramide" b="—" c="nach ihren Bestandteilen" />
      </Section>

      <Section title="Schlagarten">
        <Text style={styles.explain}>Der schlagende Stein bleibt stehen und betritt das Zielfeld nicht.</Text>
        <Bullet title="Begegnung" text="könnte im nächsten regulären Zug auf einen gegnerischen Stein gleichen Werts ziehen." />
        <Bullet title="Hinterhalt" text="zwei oder mehr eigene Steine könnten im nächsten Zug auf das Feld eines gegnerischen Steins ziehen, und ihre Summe oder Differenz ergibt dessen Wert." />
        <Bullet title="Angriff" text="könnte in regulärer Richtung auf einen gegnerischen Stein treffen, und der eigene Wert ergibt mal oder geteilt durch die Zahl der Felder dazwischen dessen Wert." />
        <Bullet title="Belagerung" text="der gegnerische Stein kann weder ziehen noch von einem einzelnen eigenen Stein befreit werden." />
      </Section>

      <Section title="Die drei Harmonien">
        {harmonyApplications.map((h) => (
          <Bullet key={h.kind} title={`${kindName[h.kind][0]!.toUpperCase()}${kindName[h.kind].slice(1)}`} text={`${h.condition}, Beispiel ${h.example.join(', ')}. Das mittlere Glied ist das ${h.mean} der äußeren.`} />
        ))}
        <Text style={styles.explain}>
          Kleiner Sieg: eine Harmonie aus drei Steinen. Großer Sieg: vier Steine mit zwei verschiedenen Harmonien. Größter Sieg: vier Steine mit allen dreien. Lage: im gegnerischen
          Feld, in aufsteigender Reihe, im rechten Winkel oder bei vieren im Quadrat, mit gleichem Abstand zueinander.
        </Text>
      </Section>

      <Section title="Noch nicht gegen die Quelle geprüft">
        {mebben.unverified.map((u) => (
          <Text key={u} style={styles.small}>
            · {u}
          </Text>
        ))}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.cell, { flex: 1, fontWeight: '600' }]}>{a}</Text>
      <Text style={[styles.cell, { flex: 1.2 }]}>{b}</Text>
      <Text style={[styles.cell, { flex: 2 }]}>{c}</Text>
    </View>
  );
}

function Bullet({ title, text }: { title: string; text: string }) {
  return (
    <Text style={styles.explain}>
      <Text style={{ fontWeight: '600', color: colors.ink }}>{title}</Text> — {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  explain: { color: colors.muted, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  section: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { color: colors.ink, fontSize: 13 },
});
