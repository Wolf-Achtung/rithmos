/**
 * Harmony -> modern use of the same mean. Data for the coach (CLAUDE.md 7.3),
 * so the language model never has to invent an application.
 */
export type HarmonyKind = 'arithmetic' | 'geometric' | 'musical';

export interface HarmonyApplication {
  readonly kind: HarmonyKind;
  readonly mean: string;
  readonly condition: string;
  readonly example: readonly [number, number, number];
  readonly historicalName: string;
  readonly modernUses: readonly string[];
}

export const harmonyApplications: readonly HarmonyApplication[] = [
  {
    kind: 'arithmetic',
    mean: 'arithmetisches Mittel',
    condition: 'b − a = c − b',
    example: [2, 4, 6],
    historicalName: 'arithmetische Proportion',
    modernUses: ['Durchschnitt einer Messreihe', 'gleitender Mittelwert', 'Mittelwert in der Notenberechnung'],
  },
  {
    kind: 'geometric',
    mean: 'geometrisches Mittel',
    condition: 'a : b = b : c',
    example: [5, 10, 20],
    historicalName: 'geometrische Proportion',
    modernUses: ['durchschnittliche Wachstumsrate', 'Zinseszins über mehrere Perioden', 'Normalisierung von Verhältnissen'],
  },
  {
    kind: 'musical',
    mean: 'harmonisches Mittel',
    condition: 'a : c = (b − a) : (c − b)',
    example: [6, 8, 12],
    historicalName: 'harmonische Proportion (Boethius: musikalisch)',
    modernUses: ['Durchschnittsgeschwindigkeit bei gleichen Strecken', 'F1-Score in der Bewertung von Klassifikationsmodellen', 'Parallelschaltung von Widerständen'],
  },
];
