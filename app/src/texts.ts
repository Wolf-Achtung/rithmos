/**
 * Fixed German wording for the app (Phase 2, no language model).
 */
import type { CaptureMethod } from '../../engine/capture';
import type { HarmonyKind } from '../../engine/harmony';
import type { Side, VictoryClass } from '../../engine/types';

export const sideName: Record<Side, string> = { white: 'Weiß', black: 'Schwarz' };
export const methodName: Record<CaptureMethod, string> = {
  meeting: 'Begegnung',
  ambush: 'Hinterhalt',
  assault: 'Angriff',
  siege: 'Belagerung',
};
export const kindName: Record<HarmonyKind, string> = {
  arithmetic: 'arithmetisch',
  geometric: 'geometrisch',
  musical: 'musikalisch',
};
export const victoryName: Record<VictoryClass, string> = {
  minor: 'Kleiner Sieg',
  major: 'Großer Sieg',
  greatest: 'Größter Sieg',
};

export const texts = {
  appTitle: 'Rithmos',
  sideNameShort: (side: Side) => (side === 'white' ? 'W' : 'S'),
  play: 'Spielen',
  coverage: 'Deckung',
  rules: 'Regeln',
  newGame: 'Neues Spiel',
  yourMove: 'Du bist am Zug. Tippe einen eigenen Stein.',
  chooseTarget: 'Tippe das Zielfeld, oder einen anderen Stein.',
  capturePrompt: 'Schläge: eigene Steine als Angreifer antippen, dann den gegnerischen Stein. Oder den Zug beenden.',
  chooseAttacker: 'Wähle zuerst den angreifenden Stein.',
  endTurn: 'Zug beenden',
  captured: (method: CaptureMethod, value: number) => `${methodName[method]}: ${value} geschlagen.`,
  capturedComponent: (method: CaptureMethod, value: number) => `${methodName[method]}: Pyramidenteil ${value} geschlagen.`,
  opponentThinking: 'Gegner denkt …',
  opponentMoved: (value: number, from: string, to: string) => `Gegner zieht ${value} von ${from} nach ${to}.`,
  opponentCaptured: (method: CaptureMethod, value: number) => `${methodName[method]}: dein Stein ${value} wurde geschlagen.`,
  opponentCannotMove: 'Der Gegner kann nicht ziehen und setzt aus.',
  youCannotMove: 'Du kannst nicht ziehen und setzt aus.',
  won: (side: Side, victory: VictoryClass, kinds: readonly HarmonyKind[], values: readonly number[]) =>
    `${victoryName[victory]} für ${sideName[side]}: ${values.join(' · ')}, ${kinds.map((k) => kindName[k]).join(' und ')}.`,
  markPrompt: 'Markiere die Felder, die deiner Meinung nach eine erreichbare Harmonie bilden. Dann weiter.',
  markHintOne: 'Eine erreichbare Harmonie existiert.',
  markHintNone: 'Keine erreichbare Harmonie in dieser Stellung.',
  markHintCount: (n: number) => (n === 1 ? 'Eine erreichbare Harmonie.' : `${n} erreichbare Harmonien.`),
  markContinue: 'Weiter zum Zug',
  markSkip: 'Ohne Markierung weiter',
  coverageResult: (pct: number) => `Deckung dieses Zuges: ${pct} %.`,
  coverageNone: 'Keine Harmonie erreichbar, dieser Zug zählt nicht für die Deckung.',
  assistName: ['Stufe 0: nichts', 'Stufe 1: Hinweis', 'Stufe 2: Anzahl', 'Stufe 3: alle Harmonien'] as const,
  strengthName: { novice: 'Novize', apprentice: 'Geselle', master: 'Meister' } as const,
  side: 'Deine Farbe',
  strength: 'Gegnerstärke',
  assist: 'Harmonie-Anzeige',
  start: 'Spiel starten',
  ruleSet: 'Regelfassung',
  loading: 'Lädt …',
  apiError: (detail: string) => `Der Server antwortet nicht (${detail}). Das Spiel läuft weiter, die Ablage wird später nachgeholt.`,
  middles: 'Middles',
  middlesIntro: (side: Side) =>
    `${sideName[side]} am Zug. Zwei Steine einer Harmonie stehen schon. Finde das Feld, auf dem der mittlere Stein sie mit einem Zug vollendet.`,
  middlesTap: 'Tippe den Stein, dann das Zielfeld.',
  middlesWrong: (n: number) => `Keine Harmonie. Versuch ${n}.`,
  middlesSolved: (kinds: readonly string[], values: readonly number[], tries: number) =>
    `Gelöst mit Versuch ${tries}: ${values.join(' · ')}, ${kinds.join(' und ')}.`,
  middlesGiveUp: 'Auflösen',
  middlesGaveUp: 'Aufgelöst. Morgen gibt es ein neues Rätsel.',
  middlesAlready: 'Das heutige Rätsel hast du schon gespielt. Morgen gibt es ein neues.',
  middlesSolution: (from: string, to: string, values: readonly number[], kinds: readonly string[]) =>
    `Lösung: ${from} nach ${to}, ${values.join(' · ')}, ${kinds.join(' und ')}.`,
  distributionTitle: (attempts: number, solved: number) => `Verteilung: ${solved} von ${attempts} gelöst, nach Versuchen`,
  distributionUnavailable: 'Verteilung gerade nicht verfügbar.',
  distributionOffline: 'Ohne Server keine Verteilung. Das Rätsel wurde lokal erzeugt.',
  offlineNote: 'Offline-Rätsel, lokal erzeugt und mit dem Solver geprüft.',
  difficulty: ['leicht', 'mittel', 'schwer'] as const,
} as const;
