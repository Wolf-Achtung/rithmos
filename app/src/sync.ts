/**
 * Account bootstrap and coverage sync. Everything here is best effort: the
 * game and the coverage trend work without the API.
 */
import { Platform } from 'react-native';
import { apiConfigured, createAccount, listCoverage, listMiddlesResults, uploadCoverage, uploadMiddlesResults } from './api/client';
import type { Session } from './api/client';
import { mergeRecords } from './coverage';
import type { CoverageRecord } from './coverage';
import { mergeSkill } from './middles/skill';
import type { SkillRecord } from './middles/skill';
import { store } from './storage';

const SESSION_KEY = 'session';

/** The stored session, or a fresh anonymous account when the API is configured. */
export async function ensureSession(): Promise<Session | null> {
  const stored = await store.read<Session | null>(SESSION_KEY, null);
  if (stored?.token) return stored;
  if (!apiConfigured) return null;
  try {
    const session = await createAccount();
    await store.write(SESSION_KEY, session);
    return session;
  } catch {
    return null;
  }
}

/** Push unsynced records, pull everything, merge. Returns the merged list. */
export async function syncCoverage(session: Session, local: readonly CoverageRecord[]): Promise<CoverageRecord[]> {
  const pending = local.filter((r) => !r.synced);
  if (pending.length > 0) {
    await uploadCoverage(
      session,
      pending.map((r) => ({ id: r.id, t: new Date(r.t).toISOString(), coverage: r.coverage, assist: r.assist, device: r.device ?? Platform.OS })),
    );
  }
  const remote = await listCoverage(session);
  return mergeRecords(
    local,
    remote.map((r) => ({ id: r.id, t: Date.parse(r.t), coverage: r.coverage, assist: r.assist, device: r.device })),
  );
}

/** The Middles records: push what the server lacks, pull everything, merge. */
export async function syncSkill(session: Session, local: readonly SkillRecord[]): Promise<SkillRecord[]> {
  const pending = local.filter((r) => !r.synced);
  if (pending.length > 0) {
    await uploadMiddlesResults(
      session,
      pending.map((r) => ({ id: r.id, t: new Date(r.t).toISOString(), mode: r.mode, level: r.level, kind: r.kind, solved: r.solved, tries: r.tries, cents: r.cents ?? null, device: Platform.OS })),
    );
  }
  const remote = await listMiddlesResults(session);
  return mergeSkill(
    local,
    remote.map((r) => ({ id: r.id, t: Date.parse(r.t), mode: r.mode, level: r.level, kind: r.kind, solved: r.solved, tries: r.tries, ...(r.cents === null ? {} : { cents: r.cents }) })),
  );
}

export const deviceName = Platform.OS;
