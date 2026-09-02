/**
 * Finds: real occurrences of the three means in the world. Data for the
 * daily puzzle (CLAUDE.md, Stufe 1: Fundstück des Tages) — a triad drawn from
 * here carries its place and its sentence. Every entry is checked by the
 * engine's recognition in a test; a find that does not verify never ships.
 * Sources are the pages the numbers were read from; the reading is Wolf's.
 */
import type { HarmonyKind } from '../harmony';

export interface Find {
  readonly id: string;
  readonly values: readonly [number, number, number];
  readonly kind: HarmonyKind;
  /** the thing: "Villa Emo" */
  readonly title: string;
  /** where or when: "Palladio, Fanzolo, um 1560" */
  readonly where: string;
  /** the one sentence after solving; may name the numbers */
  readonly sentence: string;
  readonly source: string;
}

export const finds: readonly Find[] = [
  {
    id: 'monochord',
    values: [6, 8, 12],
    kind: 'musical',
    title: 'Das Monochord',
    where: 'Pythagoreer, überliefert durch Nikomachos und Boethius',
    sentence: 'Saitenlängen 6, 8 und 12: die Quarte, die Quinte und außen die Oktave. Boethius nannte dieses Mittel deshalb das musikalische.',
    source: 'https://en.wikipedia.org/wiki/Harmonic_mean',
  },
  {
    id: 'tetraktys-arithmetic',
    values: [6, 9, 12],
    kind: 'arithmetic',
    title: 'Die Tetraktys',
    where: 'Pythagoreer',
    sentence: '6, 9 und 12 sind die andere Hälfte der Tetraktys 6 : 8 : 9 : 12 — zwischen 6 und 12 sitzt 9 arithmetisch, 8 harmonisch.',
    source: 'https://en.wikipedia.org/wiki/Tetractys',
  },
  {
    id: 'villa-emo',
    values: [12, 16, 24],
    kind: 'musical',
    title: 'Villa Emo',
    where: 'Andrea Palladio, Fanzolo, um 1560',
    sentence: 'Räume von 12, 16 und 24 Fuß: nach Wittkowers Lesart hat Palladio seine Grundrisse aus den musikalischen Proportionen gebaut.',
    source: 'https://link.springer.com/article/10.1007/s00004-019-00445-4',
  },
  {
    id: 'villa-emo-geometric',
    values: [12, 24, 48],
    kind: 'geometric',
    title: 'Villa Emo',
    where: 'Andrea Palladio, Fanzolo, um 1560',
    sentence: 'Die Villa Emo verdoppelt: 12, 24 und 48 Fuß — eine geometrische Reihe, zwei Oktaven in Stein.',
    source: 'https://link.springer.com/article/10.1007/s00004-019-00445-4',
  },
  {
    id: 'f-stops',
    values: [2, 4, 8],
    kind: 'geometric',
    title: 'Die Blendenreihe',
    where: 'jede Kamera',
    sentence: 'f/2, f/4, f/8: jede volle Blende halbiert das Licht, die Blendenzahl wächst mit √2 — von 2 zu 4 zu 8 sind es je zwei Stufen, eine geometrische Reihe.',
    source: 'https://en.wikipedia.org/wiki/F-number',
  },
  {
    id: 'average-speed',
    values: [6, 8, 12],
    kind: 'musical',
    title: 'Hin und zurück',
    where: 'jede Strecke, die man zweimal fährt',
    sentence: 'Hin mit 6, zurück mit 12: der Durchschnitt über die ganze Strecke ist 8, nicht 9 — das harmonische Mittel, weil die langsame Hälfte länger dauert.',
    source: 'https://en.wikipedia.org/wiki/Harmonic_mean#Average_speed',
  },
  {
    id: 'f1-score',
    values: [40, 48, 60],
    kind: 'musical',
    title: 'Der F1-Score',
    where: 'jedes Klassifikationsmodell',
    sentence: 'Präzision 40 %, Trefferquote 60 %: der F1-Score ist 48 % — das harmonische Mittel, damit ein Modell nicht mit einer der beiden Zahlen allein glänzen kann.',
    source: 'https://en.wikipedia.org/wiki/F-score',
  },
  {
    id: 'growth',
    values: [4, 6, 9],
    kind: 'geometric',
    title: 'Wachstum um die Hälfte',
    where: 'jede Rate, die sich multipliziert',
    sentence: '4, 6, 9: jedes Jahr um die Hälfte mehr. Eine durchschnittliche Wachstumsrate ist ein geometrisches Mittel, kein arithmetisches.',
    source: 'https://en.wikipedia.org/wiki/Geometric_mean',
  },
  {
    id: 'a-e-a',
    values: [220, 330, 440],
    kind: 'arithmetic',
    title: 'A – E – A',
    where: 'der Kammerton und seine Quinte',
    sentence: '220, 330 und 440 Hertz: A, E und das A darüber. 2 : 3 : 4 — arithmetisch in den Zahlen, Quinte und Quarte im Ohr.',
    source: 'https://en.wikipedia.org/wiki/A440_(pitch_standard)',
  },
  {
    id: 'screen-heights',
    values: [720, 1080, 1440],
    kind: 'arithmetic',
    title: '720p, 1080p, 1440p',
    where: 'jeder Bildschirm',
    sentence: '720, 1080, 1440 Zeilen: die Bildschirmhöhen wachsen in Schritten von 360 — eine arithmetische Reihe.',
    source: 'https://en.wikipedia.org/wiki/Display_resolution_standards',
  },
];
