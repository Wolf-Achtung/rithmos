/**
 * The only file that talks to the Rithmos API. Base URL from
 * EXPO_PUBLIC_API_URL; without it the app runs fully offline.
 */
import type { HarmonyKind } from '../../../engine/harmony';
import type { Side, SimpleShape } from '../../../engine/types';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const apiConfigured = API_URL.length > 0;

export interface Session {
  readonly accountId: string;
  readonly token: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new ApiError(res.status, `${init.method ?? 'GET'} ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function createAccount(): Promise<Session> {
  const r = await request<{ account_id: string; token: string }>('/v1/accounts', { method: 'POST' });
  return { accountId: r.account_id, token: r.token };
}

export interface RemoteCoverageRecord {
  readonly id: string;
  readonly t: string;
  readonly coverage: number;
  readonly assist: number;
  readonly device: string;
}

export async function uploadCoverage(session: Session, records: readonly RemoteCoverageRecord[]): Promise<{ stored: number; total: number }> {
  return request('/v1/coverage', { method: 'PUT', body: { records }, token: session.token });
}

export async function listCoverage(session: Session): Promise<RemoteCoverageRecord[]> {
  const r = await request<{ records: RemoteCoverageRecord[] }>('/v1/coverage', { token: session.token });
  return r.records;
}

export interface RemoteMiddlesResult {
  readonly id: string;
  readonly t: string;
  readonly mode: 'daily' | 'practice';
  readonly level: number;
  readonly kind: HarmonyKind;
  readonly solved: boolean;
  readonly tries: number;
  readonly cents: number | null;
  readonly device: string;
}

export async function uploadMiddlesResults(session: Session, records: readonly RemoteMiddlesResult[]): Promise<{ stored: number; total: number }> {
  return request('/v1/middles/results', { method: 'PUT', body: { records }, token: session.token });
}

export async function listMiddlesResults(session: Session): Promise<RemoteMiddlesResult[]> {
  const r = await request<{ records: RemoteMiddlesResult[] }>('/v1/middles/results', { token: session.token });
  return r.records;
}

export interface PuzzlePiece {
  readonly id: string;
  readonly side: Side;
  readonly shape: SimpleShape;
  readonly value: number;
  readonly square: string;
}

export interface PuzzleTriad {
  readonly kind: HarmonyKind;
  readonly a: number;
  readonly c: number;
  readonly options: readonly number[];
  readonly find?: { readonly id: string; readonly title: string; readonly where: string; readonly sentence: string; readonly source: string } | null;
}

export interface Puzzle {
  readonly date: string;
  readonly side: Side;
  readonly difficulty: number;
  readonly pieces: readonly PuzzlePiece[];
  /** null for puzzles ingested before the board-less form existed */
  readonly triad: PuzzleTriad | null;
  readonly attempted: boolean;
}

export interface Distribution {
  readonly attempts: number;
  readonly solved: number;
  /** tries -> number of solvers */
  readonly tries: Record<string, number>;
}

export interface PuzzleMove {
  readonly pieceId: string;
  readonly from: string;
  readonly to: string;
}

export interface AttemptResult {
  readonly solved: boolean;
  readonly solution: PuzzleMove & { readonly b: number | null };
  readonly harmony: { readonly kinds: readonly HarmonyKind[]; readonly values: readonly number[] };
  readonly distribution: Distribution;
}

/** The one attempt of the day: a board move, or the tapped middle of the triad. */
export type Attempt = { readonly move: PuzzleMove; readonly tries: number } | { readonly answer: number; readonly tries: number };

/** Today's puzzle, or null when the API has none. */
export async function fetchTodayPuzzle(session: Session | null): Promise<Puzzle | null> {
  try {
    return await request<Puzzle>('/v1/puzzles/today', session ? { token: session.token } : {});
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function submitAttempt(session: Session, date: string, attempt: Attempt, seconds: number): Promise<AttemptResult> {
  return request(`/v1/puzzles/${date}/attempts`, { method: 'POST', body: { ...attempt, seconds }, token: session.token });
}

export async function fetchDistribution(date: string): Promise<Distribution> {
  return request(`/v1/puzzles/${date}/distribution`);
}

/** The narrator (Stufe 3): two voices and three explanations, one true. Null when the server has none. */
export interface Narration {
  readonly monk: string;
  readonly analyst: string;
  readonly statements: readonly string[];
  readonly truth: number;
  readonly model: string;
  readonly version: number;
}

export async function fetchNarration(session: Session, date: string): Promise<Narration | null> {
  try {
    return await request<Narration>(`/v1/puzzles/${date}/narration`, { token: session.token });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

/** The hunt (Zug F): the vision model counts things in a photo. Null when the server has no model. */
export interface HuntResult {
  readonly groups: readonly { readonly label: string; readonly count: number }[];
  readonly model: string;
  readonly remaining: number;
}

export async function sendHunt(session: Session, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', imageBase64: string): Promise<HuntResult | null> {
  try {
    return await request<HuntResult>('/v1/hunt', { method: 'POST', body: { media_type: mediaType, image: imageBase64 }, token: session.token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** The rules chat (CLAUDE.md 8.4): an answer phrased from the rule set only. Null when the server has no model. */
export interface RuleAnswer {
  readonly answer: string;
  readonly grounded: boolean;
  readonly model: string;
  readonly remaining: number;
  readonly version: number;
}

export async function askRule(session: Session, question: string): Promise<RuleAnswer | null> {
  try {
    return await request<RuleAnswer>('/v1/rules/ask', { method: 'POST', body: { question }, token: session.token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** What is left today per feature (CLAUDE.md, Stufe 6: quotas instead of a paywall). */
export type Quota = Record<'hunt' | 'rules', { readonly limit: number; readonly remaining: number }>;

export async function fetchQuota(session: Session): Promise<Quota> {
  return request<Quota>('/v1/quota', { token: session.token });
}

/** "Erklär es mir" (CLAUDE.md 6 on the daily puzzle): the player's reason, judged into one of the four fields. */
export type ExplainVerdict = 'understood' | 'luck' | 'slip' | 'misread' | 'none';
export interface ExplainResult {
  readonly pattern: 'steps' | 'factors' | 'ratio' | 'unclear';
  readonly verdict: ExplainVerdict;
  readonly model: string;
  readonly remaining: number;
}

export async function explainAnswer(session: Session, date: string, text: string): Promise<ExplainResult | null> {
  try {
    return await request<ExplainResult>(`/v1/puzzles/${date}/explain`, { method: 'POST', body: { text }, token: session.token });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}
