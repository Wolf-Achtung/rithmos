import { describe, expect, it } from 'vitest';
import { parseSquare, place, squareIndex } from '../../../engine/board';
import { reachableHarmonies } from '../../../engine/harmony';
import { actualSquares, coverageOf, legalTargets, markMessage, newGame, reduce } from './store';
import type { GameState } from './store';

const settings = { humanSide: 'white', strength: 'novice', assist: 2 } as const;

describe('game store', () => {
  it('starts white in the mark phase below assist level 3, and in the move phase at level 3', () => {
    expect(newGame(settings).phase).toBe('mark');
    expect(newGame({ ...settings, assist: 3 }).phase).toBe('move');
    expect(newGame({ ...settings, humanSide: 'black' }).phase).toBe('opponent');
  });

  it('marks squares, scores coverage against reachable harmonies, then moves', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'e11' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h16' },
    ]);
    const reachable = reachableHarmonies(position, 'white', 1);
    const base: GameState = { ...newGame(settings), position, reachable, phase: 'mark', message: markMessage(2, reachable.length) };
    expect(base.message).toContain('Eine erreichbare Harmonie');
    const actual = actualSquares(position, reachable);
    expect([...actual].sort()).toEqual([squareIndex(position.rules, parseSquare('a10')), squareIndex(position.rules, parseSquare('c10')), squareIndex(position.rules, parseSquare('e10'))].sort());
    let s = reduce(base, { type: 'tap', square: parseSquare('a10') });
    s = reduce(s, { type: 'tap', square: parseSquare('e10') });
    s = reduce(s, { type: 'tap', square: parseSquare('b3') }); // a wrong guess
    expect(s.marked).toHaveLength(3);
    s = reduce(s, { type: 'confirm_mark' });
    expect(s.phase).toBe('move');
    expect(s.coverage).toBeCloseTo(2 / 3);
    expect(s.message).toContain('67 %');
    // select, see targets, move, capture phase, end turn wins
    s = reduce(s, { type: 'tap', square: parseSquare('e11') });
    expect(s.selected).toBe('c');
    expect(legalTargets(s).has(squareIndex(position.rules, parseSquare('e10')))).toBe(true);
    s = reduce(s, { type: 'tap', square: parseSquare('e10') });
    expect(s.phase).toBe('capture');
    s = reduce(s, { type: 'end_turn' });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('white');
    expect(s.message).toContain('Kleiner Sieg');
  });

  it('does not score a turn without a reachable harmony', () => {
    expect(coverageOf([1, 2], new Set())).toBeNull();
    const s = reduce(newGame(settings), { type: 'confirm_mark' });
    expect(s.coverage).toBeNull();
    expect(s.message).toContain('zählt nicht');
  });

  it('explains a failed capture in the capture phase', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd7' },
      { id: 'b', side: 'black', shape: 'square', value: 15, at: 'd11' },
    ]);
    let s: GameState = { ...newGame({ ...settings, assist: 3 }), position, phase: 'move' };
    s = reduce(s, { type: 'tap', square: parseSquare('d7') });
    s = reduce(s, { type: 'tap', square: parseSquare('d8') });
    expect(s.phase).toBe('capture');
    s = reduce(s, { type: 'tap', square: parseSquare('d11') });
    expect(s.message).toContain('Wähle zuerst');
    s = reduce(s, { type: 'tap', square: parseSquare('d8') });
    s = reduce(s, { type: 'tap', square: parseSquare('d11') });
    expect(s.message).toBe('Angriff über zwei Felder: 5 × 2 = 10, 5 : 2 geht nicht auf, dein Ziel hat 15. Mit drei Feldern Abstand würde es passen.');
    expect(s.position.pieces).toHaveLength(2);
  });

  it('applies a holding capture', () => {
    const position = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd7' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    let s: GameState = { ...newGame({ ...settings, assist: 3 }), position, phase: 'move' };
    s = reduce(s, { type: 'tap', square: parseSquare('d7') });
    s = reduce(s, { type: 'tap', square: parseSquare('d8') });
    s = reduce(s, { type: 'tap', square: parseSquare('d8') });
    s = reduce(s, { type: 'tap', square: parseSquare('d11') });
    expect(s.message).toBe('Angriff: 10 geschlagen.');
    expect(s.position.pieces.map((p) => p.id)).toEqual(['a']);
  });
});
