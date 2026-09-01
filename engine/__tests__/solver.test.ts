import { describe, expect, it } from 'vitest';
import { parseSquare, place } from '../board';
import { turnToString } from '../game';
import { solvePuzzle, verifyPuzzle } from '../solver';

describe('solver', () => {
  it('finds the unique move that completes 2/4/6 (a Middles puzzle)', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a10' },
      { id: 'b', side: 'white', shape: 'round', value: 6, at: 'e10' },
      { id: 'm', side: 'white', shape: 'round', value: 4, at: 'b10' },
      { id: 'o', side: 'white', shape: 'round', value: 8, at: 'h16' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    const r = solvePuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 });
    expect(r.unique).toBe(true);
    expect(r.solutions.map((s) => turnToString(s.turns[0]!))).toEqual(['m b10-c10']);
    expect(r.solutions[0]!.harmony?.kinds).toEqual(['arithmetic']);
    expect(verifyPuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 }, { pieceId: 'm', from: parseSquare('b10'), to: parseSquare('c10') })).toMatchObject({ valid: true });
    expect(verifyPuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 }, { pieceId: 'o', from: parseSquare('h16'), to: parseSquare('h15') }).valid).toBe(false);
  });

  it('reports several solutions', () => {
    // a round 4 from b10 and a triangle 4 from a12 can both arrive at c10
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a10' },
      { id: 'b', side: 'white', shape: 'round', value: 6, at: 'e10' },
      { id: 'm1', side: 'white', shape: 'round', value: 4, at: 'b10' },
      { id: 'm2', side: 'white', shape: 'triangle', value: 4, at: 'a12' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    const r = solvePuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 });
    expect(r.unique).toBe(false);
    expect(r.solutions).toHaveLength(2);
    expect(verifyPuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 }, { pieceId: 'm1', from: parseSquare('b10'), to: parseSquare('c10') }).reason).toMatch(/several/);
  });

  it('filters by harmony kind and victory class', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a10' },
      { id: 'b', side: 'white', shape: 'round', value: 6, at: 'e10' },
      { id: 'm', side: 'white', shape: 'round', value: 4, at: 'b10' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    expect(solvePuzzle({ position, goal: { kind: 'harmony', harmony: 'geometric' }, movesAllowed: 1 }).solutions).toHaveLength(0);
    expect(solvePuzzle({ position, goal: { kind: 'harmony', minVictory: 'major' }, movesAllowed: 1 }).solutions).toHaveLength(0);
    expect(solvePuzzle({ position, goal: { kind: 'harmony', harmony: 'arithmetic', minVictory: 'minor' }, movesAllowed: 1 }).solutions).toHaveLength(1);
  });

  it('capture puzzles: the one move that sets up an assault', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'c8' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
      { id: 'z', side: 'black', shape: 'square', value: 361, at: 'a16' },
    ]);
    const r = solvePuzzle({ position, goal: { kind: 'capture', target: 'b', method: 'assault' }, movesAllowed: 1 });
    expect(r.unique).toBe(true);
    expect(turnToString(r.solutions[0]!.turns[0]!)).toBe('a c8-d8 (assault xb)');
    expect(solvePuzzle({ position, goal: { kind: 'capture', target: 'ghost' }, movesAllowed: 1 }).solutions).toHaveLength(0);
  });

  it('two own moves', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 6, at: 'd10' },
      { id: 'm', side: 'white', shape: 'round', value: 4, at: 'c13' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h1' },
    ]);
    expect(solvePuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 1 }).solutions).toHaveLength(0);
    const r = solvePuzzle({ position, goal: { kind: 'harmony' }, movesAllowed: 2 });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.every((s) => s.turns.length === 2)).toBe(true);
  });
});
