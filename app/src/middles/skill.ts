/**
 * The Middles form of the coverage metric (CLAUDE.md 7): hit rate per mean
 * over a sliding window of the last fifty puzzles, and the trend over weeks.
 * Pure functions over stored records. The daily puzzle and practice both
 * write here; the progression reads which mean lags.
 */
import { HARMONY_KINDS } from '../../../engine/harmony';
import type { HarmonyKind } from '../../../engine/harmony';
import { weekStart } from '../coverage';

export interface SkillRecord {
  readonly id: string;
  /** Unix milliseconds. */
  readonly t: number;
  readonly mode: 'daily' | 'practice';
  /** practice level 1..5; the daily counts as level 0 */
  readonly level: number;
  readonly kind: HarmonyKind;
  readonly solved: boolean;
  readonly tries: number;
  /** deviation of a tuned answer from the mean, in cents; absent when tapped */
  readonly cents?: number;
  /** the sense the answer came through (CLAUDE.md 2, andere Sinne); absent when typed. Device only. */
  readonly sense?: 'length' | 'tone';
  /** the find the puzzle came from, for the collection. Device only. */
  readonly find?: string;
  /** true once the server has the record */
  readonly synced?: boolean;
}

export const SKILL_WINDOW = 50;

/** Union of local and remote records by id; the local copy wins, everything present counts as synced. */
export function mergeSkill(local: readonly SkillRecord[], remote: readonly SkillRecord[]): SkillRecord[] {
  const byId = new Map<string, SkillRecord>();
  for (const r of remote) byId.set(r.id, { ...r, synced: true });
  for (const r of local) byId.set(r.id, { ...r, synced: byId.has(r.id) || r.synced === true });
  return [...byId.values()].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
}

export interface HitRate {
  readonly kind: HarmonyKind;
  /** puzzles of this kind inside the window */
  readonly n: number;
  /** solved / n, or null without puzzles */
  readonly rate: number | null;
}

/** Hit rate per kind over the last `window` puzzles overall. */
export function hitRates(records: readonly SkillRecord[], window = SKILL_WINDOW): HitRate[] {
  const last = [...records].sort((a, b) => a.t - b.t).slice(-window);
  return HARMONY_KINDS.map((kind) => {
    const mine = last.filter((r) => r.kind === kind);
    const solved = mine.filter((r) => r.solved).length;
    return { kind, n: mine.length, rate: mine.length === 0 ? null : solved / mine.length };
  });
}

export interface WeekHitBucket {
  readonly weekStart: number;
  readonly byKind: Record<HarmonyKind, { readonly n: number; readonly solved: number }>;
}

/** Per week, per kind: how many and how many solved. Oldest first. */
export function weeklyHitTrend(records: readonly SkillRecord[]): WeekHitBucket[] {
  const weeks = new Map<number, Record<HarmonyKind, { n: number; solved: number }>>();
  for (const r of records) {
    const w = weekStart(r.t);
    const bucket = weeks.get(w) ?? { arithmetic: { n: 0, solved: 0 }, geometric: { n: 0, solved: 0 }, musical: { n: 0, solved: 0 } };
    bucket[r.kind].n++;
    if (r.solved) bucket[r.kind].solved++;
    weeks.set(w, bucket);
  }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([weekStart, byKind]) => ({ weekStart, byKind }));
}

/** Enough evidence to call a mean weak or strong. */
export const MIN_EVIDENCE = 5;

/**
 * The mean that lags: the lowest hit rate among kinds with enough evidence;
 * without evidence, the kind seen least. Null only when all rates are level.
 */
export function weakestKind(records: readonly SkillRecord[], window = SKILL_WINDOW): HarmonyKind | null {
  const rates = hitRates(records, window);
  const unseen = rates.filter((r) => r.n < MIN_EVIDENCE);
  if (unseen.length > 0) return unseen.sort((a, b) => a.n - b.n)[0]!.kind;
  const sorted = [...rates].sort((a, b) => a.rate! - b.rate!);
  const lowest = sorted[0]!;
  const highest = sorted[sorted.length - 1]!;
  return highest.rate! - lowest.rate! < 0.15 ? null : lowest.kind;
}

/** How many practice puzzles of a level were solved. */
export function solvedAtLevel(records: readonly SkillRecord[], level: number): number {
  return records.filter((r) => r.mode === 'practice' && r.level === level && r.solved).length;
}
