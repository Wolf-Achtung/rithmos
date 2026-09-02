import { describe, expect, it } from 'vitest';
import { centsBetween, judgeRelease, positionOf, snapNear, valueAt } from './tuning';

describe('tuning by ear', () => {
  it('runs the slider evenly in pitch between a and c', () => {
    expect(valueAt(0, 6, 12)).toBeCloseTo(6);
    expect(valueAt(1, 6, 12)).toBeCloseTo(12);
    expect(valueAt(0.5, 6, 12)).toBeCloseTo(Math.sqrt(72)); // the geometric mean sits in the middle of the octave
    expect(valueAt(positionOf(8, 6, 12), 6, 12)).toBeCloseTo(8);
    expect(valueAt(positionOf(9, 6, 12), 6, 12)).toBeCloseTo(9);
  });

  it('measures cents like a tuner', () => {
    expect(centsBetween(12, 6)).toBeCloseTo(1200);
    expect(centsBetween(8, 8)).toBe(0);
    expect(centsBetween(8.1, 8)).toBeCloseTo(21.5, 0);
  });

  it('snaps to the nearest whole-number mean inside the snap width', () => {
    expect(snapNear(8.03, 6, 12)).toMatchObject({ kind: 'musical', value: 8 });
    expect(snapNear(9.02, 6, 12)).toMatchObject({ kind: 'arithmetic', value: 9 });
    expect(snapNear(8.5, 6, 12)).toBeNull();
    expect(snapNear(4, 2, 8)).toMatchObject({ kind: 'geometric', value: 4 });
  });

  it('judges a release: right, the other mean, or off', () => {
    expect(judgeRelease(8.05, 8, 'musical', 6, 12).kind).toBe('right');
    expect(judgeRelease(9.02, 8, 'musical', 6, 12)).toMatchObject({ kind: 'otherMean', mean: 'arithmetic', value: 9 });
    const off = judgeRelease(10.4, 8, 'musical', 6, 12);
    expect(off).toMatchObject({ kind: 'off', nearest: 10 });
    expect(off.cents).toBeGreaterThan(400);
  });
});
