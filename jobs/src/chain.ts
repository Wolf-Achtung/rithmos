/**
 * The chain (CLAUDE.md, Zug D): a second daily puzzle, constructive instead
 * of asked. Twelve numbers lie out; the player lays them into a chain where
 * every three in a row form a harmony, each link sharing two numbers with the
 * next: 2 · 4 · 6 · 9 · 12 · 16 · 24 · 48. Score is the length reached.
 * Deterministic per date, the longest chain computed by search.
 */
import { harmonyKinds } from '../../engine/harmony';
import type { HarmonyKind } from '../../engine/harmony';
import { middlesNumber, mulberry32, seedForDate } from './middles';

export const CHAIN_SIZE = 12;
export const CHAIN_MIN = 5;
export const CHAIN_MAX_VALUE = 96;

export interface ChainPuzzle {
  readonly date: string;
  /** the twelve numbers, ascending */
  readonly numbers: readonly number[];
  /** the longest chain any player can lay */
  readonly best: number;
  /** one chain of that length, for the reveal */
  readonly solution: readonly number[];
}

/** Is `next` a valid continuation: the last two and it form a harmony, ascending. */
export function linkKind(chain: readonly number[], next: number): HarmonyKind | null {
  if (chain.length < 2) return null;
  const a = chain[chain.length - 2]!;
  const b = chain[chain.length - 1]!;
  const kinds = harmonyKinds(a, b, next);
  return kinds[0] ?? null;
}

/** May `next` be laid after the chain? The first two numbers only need to ascend. */
export function canLay(chain: readonly number[], next: number): boolean {
  const last = chain[chain.length - 1];
  if (last !== undefined && next <= last) return false;
  if (chain.length < 2) return true;
  return linkKind(chain, next) !== null;
}

/** The longest chain over a set of numbers, and one witness. Exhaustive: twelve numbers is small. */
export function longestChain(numbers: readonly number[]): { length: number; chain: number[] } {
  const sorted = [...new Set(numbers)].sort((x, y) => x - y);
  let best: number[] = sorted.length > 0 ? [sorted[0]!] : [];
  const visit = (chain: number[]) => {
    if (chain.length > best.length) best = [...chain];
    const last = chain[chain.length - 1]!;
    for (const n of sorted) {
      if (n <= last) continue;
      if (chain.length >= 2 && linkKind(chain, n) === null) continue;
      chain.push(n);
      visit(chain);
      chain.pop();
    }
  };
  for (const start of sorted) visit([start]);
  return { length: best.length, chain: best };
}

/** Grow a chain from a pair by whole-number continuations, preferring the smaller ones. */
function growChain(rnd: () => number, maxValue: number): number[] {
  const starts: [number, number][] = [
    [2, 3],
    [2, 4],
    [3, 4],
    [3, 6],
    [4, 6],
    [4, 8],
    [6, 8],
    [6, 9],
    [5, 10],
  ];
  const chain: number[] = [...starts[Math.floor(rnd() * starts.length)]!];
  for (;;) {
    const a = chain[chain.length - 2]!;
    const b = chain[chain.length - 1]!;
    const nexts: number[] = [];
    for (let c = b + 1; c <= maxValue; c++) if (harmonyKinds(a, b, c).length > 0) nexts.push(c);
    if (nexts.length === 0) break;
    // the smaller continuation more often, so chains stay within reach
    const pick = nexts[Math.min(nexts.length - 1, Math.floor(Math.pow(rnd(), 2) * nexts.length))]!;
    chain.push(pick);
    if (chain.length >= 9) break;
  }
  return chain;
}

/** The chain puzzle for a date. Tries seeds until a chain of CHAIN_MIN links fits. */
export function generateChain(date: string, maxAttempts = 200): ChainPuzzle {
  const base = (seedForDate(date) ^ 0x5bd1e995) >>> 0;
  for (let i = 0; i < maxAttempts; i++) {
    const rnd = mulberry32((base + i * 104729) >>> 0);
    const chain = growChain(rnd, CHAIN_MAX_VALUE);
    if (chain.length < CHAIN_MIN) continue;
    const set = new Set(chain);
    let guard = 0;
    while (set.size < CHAIN_SIZE && guard++ < 500) {
      const v = 2 + Math.floor(rnd() * (CHAIN_MAX_VALUE - 1));
      if (!set.has(v)) set.add(v);
    }
    if (set.size < CHAIN_SIZE) continue;
    const numbers = [...set].sort((x, y) => x - y);
    const { length, chain: solution } = longestChain(numbers);
    if (length < CHAIN_MIN) continue;
    return { date, numbers, best: length, solution };
  }
  throw new Error(`no chain puzzle for ${date} within ${maxAttempts} attempts`);
}

/** Re-check: twelve distinct numbers, and the stated best is the longest chain. */
export function verifyChain(p: ChainPuzzle): { valid: boolean; reason: string } {
  if (p.numbers.length !== CHAIN_SIZE || new Set(p.numbers).size !== CHAIN_SIZE) return { valid: false, reason: 'twelve distinct numbers expected' };
  const { length } = longestChain(p.numbers);
  if (length !== p.best) return { valid: false, reason: `best is ${length}, stated ${p.best}` };
  if (p.solution.length !== p.best || !p.solution.every((n) => p.numbers.includes(n))) return { valid: false, reason: 'solution is not a chain of best length' };
  for (let i = 2; i < p.solution.length; i++) if (linkKind(p.solution.slice(0, i), p.solution[i]!) === null) return { valid: false, reason: 'solution breaks' };
  return { valid: true, reason: 'ok' };
}

/** `Kette Nº 47 · 6/7` */
export function chainShareText(date: string, reached: number, best: number): string {
  return `Kette Nº ${middlesNumber(date)} · ${reached}/${best}`;
}
