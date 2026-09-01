import { describe, expect, it } from 'vitest';
import { parseSquare, place } from '../board';
import { verifyClaim } from '../claims';
import type { Move } from '../moves';

const mv = (pieceId: string, from: string, to: string): Move => ({ pieceId, from: parseSquare(from), to: parseSquare(to) });

describe('verifyClaim', () => {
  describe('capture_threat', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'd7' },
      { id: 'b', side: 'black', shape: 'round', value: 10, at: 'd11' },
      { id: 'c', side: 'black', shape: 'round', value: 7, at: 'a16' },
    ]);
    it('holds: after d7-d8 the round 5 assaults 10 over two squares', () => {
      const r = verifyClaim(pos, mv('a', 'd7', 'd8'), { kind: 'capture_threat', from: 'a', to: 'b' });
      expect(r).toMatchObject({ holds: true, checkedAt: 'after' });
      expect(r.evidence).toContain('assault');
    });
    it('holds with the right method, fails with the wrong one', () => {
      expect(verifyClaim(pos, mv('a', 'd7', 'd8'), { kind: 'capture_threat', from: 'a', to: 'b', method: 'assault' }).holds).toBe(true);
      const r = verifyClaim(pos, mv('a', 'd7', 'd8'), { kind: 'capture_threat', from: 'a', to: 'b', method: 'meeting' });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('Begegnung');
    });
    it('fails: the threat is claimed against the wrong piece', () => {
      const r = verifyClaim(pos, mv('a', 'd7', 'd8'), { kind: 'capture_threat', from: 'a', to: 'c' });
      expect(r.holds).toBe(false);
    });
    it('fails for a piece that does not exist', () => {
      const r = verifyClaim(pos, mv('a', 'd7', 'd8'), { kind: 'capture_threat', from: 'a', to: 'ghost' });
      expect(r).toEqual({ holds: false, evidence: 'unknown piece: ghost', checkedAt: 'before' });
    });
    it('fails for an illegal move', () => {
      const r = verifyClaim(pos, mv('a', 'd7', 'd9'), { kind: 'capture_threat', from: 'a', to: 'b' });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('illegal move');
    });
  });

  describe('harmony_reachable', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd12' },
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'h16' },
    ]);
    it('holds: the move completes 2/4/6 (within 0)', () => {
      const r = verifyClaim(pos, mv('c', 'd12', 'd11'), { kind: 'harmony_reachable', pieces: ['a', 'b', 'c'], harmony: 'arithmetic', withinMoves: 0 });
      expect(r.holds).toBe(false); // d11 does not complete it: b10, c10, d11 is not a line
      const r2 = verifyClaim(pos, mv('c', 'd12', 'c12'), { kind: 'harmony_reachable', pieces: ['a', 'b', 'c'], withinMoves: 1 });
      expect(r2.holds).toBe(true); // c12 -> c11 forms the angle b10, c10, c11
      expect(r2.evidence).toContain('arithmetic');
    });
    it('fails with the wrong kind', () => {
      const r = verifyClaim(pos, mv('c', 'd12', 'c12'), { kind: 'harmony_reachable', pieces: ['a', 'b', 'c'], harmony: 'geometric', withinMoves: 1 });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('no geometric harmony');
    });
    it('fails for a piece that does not exist', () => {
      const r = verifyClaim(pos, mv('c', 'd12', 'c12'), { kind: 'harmony_reachable', pieces: ['a', 'zz'], withinMoves: 1 });
      expect(r.evidence).toBe('unknown piece: zz');
    });
  });

  describe('defends', () => {
    // black 10 assaults white 5 over two squares (d11 -> d8). White can block with round 2 on d9.
    const pos = place([
      { id: 'v', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'g', side: 'white', shape: 'round', value: 2, at: 'c9' },
      { id: 'att', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    it('holds when the threat existed and is gone after the move', () => {
      const r = verifyClaim(pos, mv('g', 'c9', 'd9'), { kind: 'defends', piece: 'v', against: 'att' });
      expect(r).toMatchObject({ holds: true, checkedAt: 'after' });
    });
    it('fails when the move leaves the threat', () => {
      const r = verifyClaim(pos, mv('g', 'c9', 'b9'), { kind: 'defends', piece: 'v', against: 'att' });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('still threatens');
    });
    it('fails when there was no threat', () => {
      const r = verifyClaim(pos, mv('g', 'c9', 'd9'), { kind: 'defends', piece: 'g', against: 'att' });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('did not threaten');
    });
    it('fails for a piece that does not exist', () => {
      expect(verifyClaim(pos, mv('g', 'c9', 'd9'), { kind: 'defends', piece: 'v', against: 'nobody' }).evidence).toBe('unknown piece: nobody');
    });
  });

  describe('escapes', () => {
    const pos = place([
      { id: 'v', side: 'white', shape: 'round', value: 5, at: 'd8' },
      { id: 'att', side: 'black', shape: 'round', value: 10, at: 'd11' },
    ]);
    it('holds when the threatened piece steps out of the line', () => {
      const r = verifyClaim(pos, mv('v', 'd8', 'c8'), { kind: 'escapes', piece: 'v', from: 'att' });
      expect(r.holds).toBe(true);
    });
    it('fails when it stays in the line at a fitting distance', () => {
      // d8 -> d9: one square between, 10 : 1 = 10, no; 10 x 1 = 10, no; target 5: 10 / 2? distance is 1 -> no capture.
      // Use d8 -> d7 instead: three squares between, 10 x 3 = 30, 10 : 3 no. Also safe. So build a failing case:
      const pos2 = place([
        { id: 'v', side: 'white', shape: 'round', value: 5, at: 'd8' },
        { id: 'att', side: 'black', shape: 'round', value: 5, at: 'd10' },
      ]);
      // before: assault 5 x 1 = 5 over one square. d8 -> d9: adjacent, equal values: meeting. Still threatened.
      const r = verifyClaim(pos2, mv('v', 'd8', 'd9'), { kind: 'escapes', piece: 'v', from: 'att' });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('meeting');
    });
    it('fails when another piece moves', () => {
      const pos3 = place([
        { id: 'v', side: 'white', shape: 'round', value: 5, at: 'd8' },
        { id: 'o', side: 'white', shape: 'round', value: 2, at: 'a1' },
        { id: 'att', side: 'black', shape: 'round', value: 10, at: 'd11' },
      ]);
      const r = verifyClaim(pos3, mv('o', 'a1', 'a2'), { kind: 'escapes', piece: 'v', from: 'att' });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('does not move');
    });
    it('fails for a piece that does not exist', () => {
      expect(verifyClaim(pos, mv('v', 'd8', 'c8'), { kind: 'escapes', piece: 'v', from: 'zz' }).evidence).toBe('unknown piece: zz');
    });
  });

  describe('blocks_harmony', () => {
    // black 3, 6 stand at b2, c2; the black triangle 12 at f4 can move to d2 and complete 3/6/12 geometric.
    const pos = place([
      { id: 'x', side: 'black', shape: 'round', value: 3, at: 'b2' },
      { id: 'y', side: 'black', shape: 'round', value: 6, at: 'c2' },
      { id: 'z', side: 'black', shape: 'triangle', value: 12, at: 'f4' },
      { id: 'w', side: 'white', shape: 'round', value: 8, at: 'e2' },
      { id: 'far', side: 'white', shape: 'round', value: 2, at: 'h8' },
    ]);
    it('holds when the move takes the completing square', () => {
      const r = verifyClaim(pos, mv('w', 'e2', 'd2'), { kind: 'blocks_harmony', opponentPieces: ['x', 'y', 'z'] });
      expect(r.holds).toBe(true);
      expect(r.evidence).toContain('geometric');
    });
    it('fails when the move does not touch the harmony', () => {
      const r = verifyClaim(pos, mv('far', 'h8', 'h7'), { kind: 'blocks_harmony', opponentPieces: ['x', 'y', 'z'] });
      expect(r.holds).toBe(false);
      expect(r.evidence).toContain('still reachable');
    });
    it('fails when the opponent had no such harmony', () => {
      const r = verifyClaim(pos, mv('w', 'e2', 'd2'), { kind: 'blocks_harmony', opponentPieces: ['x', 'y'] });
      // x and y are part of the reachable harmony, so this holds; ask for a set that is not:
      expect(r.holds).toBe(true);
      const r2 = verifyClaim(pos, mv('w', 'e2', 'd2'), { kind: 'blocks_harmony', opponentPieces: ['x'] });
      expect(r2.holds).toBe(true);
      const pos2 = place([
        { id: 'x', side: 'black', shape: 'round', value: 3, at: 'b2' },
        { id: 'y', side: 'black', shape: 'round', value: 7, at: 'c2' },
        { id: 'w', side: 'white', shape: 'round', value: 8, at: 'e2' },
      ]);
      const r3 = verifyClaim(pos2, mv('w', 'e2', 'd2'), { kind: 'blocks_harmony', opponentPieces: ['x', 'y'] });
      expect(r3.holds).toBe(false);
      expect(r3.evidence).toContain('no harmony');
    });
    it('fails for a piece that does not exist', () => {
      expect(verifyClaim(pos, mv('w', 'e2', 'd2'), { kind: 'blocks_harmony', opponentPieces: ['x', 'nope'] }).evidence).toBe('unknown piece: nope');
    });
  });

  it('unverifiable never holds and evaluates nothing', () => {
    const pos = place([{ id: 'a', side: 'white', shape: 'round', value: 2, at: 'a1' }]);
    expect(verifyClaim(pos, mv('a', 'a1', 'a2'), { kind: 'unverifiable', reason: 'no pieces named' })).toEqual({
      holds: false,
      evidence: 'unverifiable: no pieces named',
      checkedAt: 'before',
    });
  });
});
