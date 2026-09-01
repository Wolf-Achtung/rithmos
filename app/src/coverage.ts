/**
 * Coverage (Maschinen-Deckung): how much of what the engine sees the player
 * marked without help. Pure functions over stored records; the trend is shown
 * over weeks, never as a single value (CLAUDE.md section 6).
 */
export interface CoverageRecord {
  /** Unix milliseconds. */
  readonly t: number;
  /** 0..1 for one move. */
  readonly coverage: number;
  readonly assist: number;
}

export const WINDOW = 50;

/** Mean over the last `WINDOW` scored moves, or null without records. */
export function windowAverage(records: readonly CoverageRecord[], window = WINDOW): number | null {
  const last = records.slice(-window);
  if (last.length === 0) return null;
  return last.reduce((s, r) => s + r.coverage, 0) / last.length;
}

/** Monday 00:00 UTC of the week containing t. */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export interface WeekBucket {
  readonly weekStart: number;
  readonly moves: number;
  readonly average: number;
}

/** Weekly averages, oldest first. */
export function weeklyTrend(records: readonly CoverageRecord[]): WeekBucket[] {
  const sums = new Map<number, { n: number; sum: number }>();
  for (const r of records) {
    const w = weekStart(r.t);
    const b = sums.get(w) ?? { n: 0, sum: 0 };
    b.n++;
    b.sum += r.coverage;
    sums.set(w, b);
  }
  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStart, b]) => ({ weekStart, moves: b.n, average: b.sum / b.n }));
}

export function formatWeek(weekStart: number): string {
  const d = new Date(weekStart);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.`;
}
