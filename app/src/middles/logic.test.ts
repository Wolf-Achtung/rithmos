import { describe, expect, it } from 'vitest';
import { feedbackFor, isFinished, previousDay, recordAnswer, shareText, streakOn } from './logic';
import type { DayResult } from './logic';

describe('feedback for an offer', () => {
  const musical = { kind: 'musical', a: 6, c: 12 } as const;
  it('names the mean the player had in mind', () => {
    expect(feedbackFor(musical, 8)).toEqual({ kind: 'right' });
    expect(feedbackFor(musical, 9)).toEqual({ kind: 'otherMean', mean: 'arithmetic' });
    expect(feedbackFor(musical, 7)).toEqual({ kind: 'wrong' });
    expect(feedbackFor({ kind: 'arithmetic', a: 2, c: 8 }, 4)).toEqual({ kind: 'otherMean', mean: 'geometric' });
    expect(feedbackFor({ kind: 'geometric', a: 2, c: 8 }, 5)).toEqual({ kind: 'otherMean', mean: 'arithmetic' });
  });
});

describe('a day and its streak', () => {
  const day = (date: string, solved: boolean, answers: number[]): DayResult => ({ date, solved, answers });
  it('counts solved days back from today, or from yesterday when today is still open', () => {
    const results = [day('2026-09-01', true, [8]), day('2026-09-02', true, [9, 8]), day('2026-09-03', true, [8])];
    expect(streakOn(results, '2026-09-03')).toBe(3);
    expect(streakOn(results, '2026-09-04')).toBe(3);
    expect(streakOn(results, '2026-09-05')).toBe(0);
    expect(streakOn([...results, day('2026-09-04', false, [1, 2, 3])], '2026-09-04')).toBe(0);
    expect(streakOn([], '2026-09-04')).toBe(0);
  });

  it('records answers in order and knows when the day is over', () => {
    let results: DayResult[] = [];
    results = recordAnswer(results, '2026-09-02', 9, false);
    expect(isFinished(results[0])).toBe(false);
    results = recordAnswer(results, '2026-09-02', 8, true);
    expect(results).toEqual([day('2026-09-02', true, [9, 8])]);
    expect(isFinished(results[0])).toBe(true);
    const spent = recordAnswer(recordAnswer(recordAnswer([], '2026-09-03', 1, false), '2026-09-03', 2, false), '2026-09-03', 3, false);
    expect(isFinished(spent[0])).toBe(true);
    expect(isFinished(undefined)).toBe(false);
  });

  it('crosses month and year boundaries', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });
});

describe('share text', () => {
  it('is number, score and three boxes, no emoji', () => {
    expect(shareText('2026-10-17', { solved: true, answers: [9, 8] })).toBe('Middles Nº 47 · 2/3\n■■□');
    expect(shareText('2026-09-01', { solved: true, answers: [8] })).toBe('Middles Nº 1 · 1/3\n■□□');
    expect(shareText('2026-09-01', { solved: false, answers: [1, 2, 3] })).toBe('Middles Nº 1 · X/3\n■■■');
  });
});
