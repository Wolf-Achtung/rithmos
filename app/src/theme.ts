/**
 * The one place for colour, type and spacing. Direction "Klang": dark by
 * default, luminous numerals, one mint accent for what sounds together and
 * one amber accent for what is still missing. Nothing in the app carries a
 * colour or a face that is not named here (CLAUDE.md, Gestaltung).
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  readonly background: string;
  readonly surface: string;
  readonly border: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly muted: string;
  /** what sounds together: the answer, the waves, the streak */
  readonly accent: string;
  readonly accentInk: string;
  readonly accentGlow: string;
  /** what is still missing: the question mark, a wrong offer */
  readonly missing: string;
  readonly missingGlow: string;
  readonly wrong: string;
  readonly trackEmpty: string;
}

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    background: '#0E0F1A',
    surface: '#16182A',
    border: '#262A42',
    ink: '#F2EFE6',
    inkSoft: '#C9C7D6',
    muted: '#9A9BAE',
    accent: '#7FE0C0',
    accentInk: '#0E0F1A',
    accentGlow: 'rgba(127, 224, 192, 0.55)',
    missing: '#F0B27A',
    missingGlow: 'rgba(240, 178, 122, 0.45)',
    wrong: '#E07A7F',
    trackEmpty: '#262A42',
  },
  light: {
    background: '#F5F3EC',
    surface: '#FFFFFF',
    border: '#DCD9CF',
    ink: '#14152A',
    inkSoft: '#3E4058',
    muted: '#6E7089',
    accent: '#1E9C78',
    accentInk: '#F5F3EC',
    accentGlow: 'rgba(30, 156, 120, 0.35)',
    missing: '#C7761F',
    missingGlow: 'rgba(199, 118, 31, 0.3)',
    wrong: '#B8474D',
    trackEmpty: '#DCD9CF',
  },
};

/** Face names as registered with expo-font; the fallbacks cover the moment before they load. */
export const fonts = {
  numeralLight: 'BricolageGrotesque_300Light',
  numeral: 'BricolageGrotesque_500Medium',
  numeralBold: 'BricolageGrotesque_700Bold',
  text: 'DMSans_400Regular',
  textMedium: 'DMSans_500Medium',
} as const;

export const type = {
  numeral: { fontSize: 96, letterSpacing: -3.5, lineHeight: 104 },
  offer: { fontSize: 36, letterSpacing: -1, lineHeight: 44 },
  title: { fontSize: 18, letterSpacing: 0.4, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 13, lineHeight: 18 },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32, xxl: 48 } as const;

export const radius = { pill: 999, card: 20, box: 4 } as const;

/** Kept for the board screens of the first version (out of the navigation until Stufe 4). */
export const colors = {
  background: palettes.dark.background,
  surface: palettes.dark.surface,
  ink: palettes.dark.ink,
  muted: palettes.dark.muted,
  border: palettes.dark.border,
  squareLight: '#1C1F33',
  squareDark: '#131524',
  enemyHalfTint: 'rgba(127, 224, 192, 0.05)',
  whitePiece: '#F2EFE6',
  whitePieceInk: '#0E0F1A',
  blackPiece: '#2A2D45',
  blackPieceInk: '#F2EFE6',
  selected: palettes.dark.missing,
  target: 'rgba(127, 224, 192, 0.35)',
  lastMove: 'rgba(240, 178, 122, 0.3)',
  marked: 'rgba(127, 224, 192, 0.45)',
  harmony: 'rgba(127, 224, 192, 0.5)',
  attacker: 'rgba(224, 122, 127, 0.5)',
  accent: palettes.dark.accent,
  danger: palettes.dark.wrong,
  ok: palettes.dark.accent,
} as const;
