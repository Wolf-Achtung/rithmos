/**
 * The collection (CLAUDE.md 2, Fundstück zuerst): every find the player has
 * solved, on the daily or in practice, becomes a card. Pure, no I/O.
 */
import { finds } from '../../../engine/rules/finds';
import type { Find } from '../../../engine/rules/finds';
import type { DayResult } from './logic';
import type { SkillRecord } from './skill';

/** Ids of the finds solved so far, from the daily results and the practice records. */
export function foundIds(days: readonly Pick<DayResult, 'solved' | 'find'>[], records: readonly Pick<SkillRecord, 'solved' | 'find'>[]): Set<string> {
  const out = new Set<string>();
  for (const d of days) if (d.solved && d.find) out.add(d.find);
  for (const r of records) if (r.solved && r.find) out.add(r.find);
  return out;
}

export interface Collection {
  readonly found: readonly Find[];
  readonly total: number;
}

/** The finds in table order, those solved first. */
export function collection(ids: ReadonlySet<string>, table: readonly Find[] = finds): Collection {
  return { found: table.filter((f) => ids.has(f.id)), total: table.length };
}
