import { describe, expect, it } from 'vitest';
import { feedbackFor, isFinished, previousDay, recordAnswer, shareText, streakOn, gapLine, patternExample } from './logic';
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
    const tuned = recordAnswer([], '2026-09-05', 8.3, false, 64);
    expect(tuned[0]).toEqual({ date: '2026-09-05', solved: false, answers: [8.3], cents: 64 });
    expect(recordAnswer(tuned, '2026-09-05', 8, true, 3)[0]).toMatchObject({ solved: true, answers: [8.3, 8], cents: 3 });
  });

  it('crosses month and year boundaries', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });
});

describe('share text', () => {
  it('is number, score and three boxes, no emoji', () => {
    expect(shareText('2026-10-17', { solved: true, answers: [9, 8] })).toBe('Rithmos Nº 47 · 2/3\n■■□\nrithmos.de');
    expect(shareText('2026-09-01', { solved: true, answers: [8] })).toBe('Rithmos Nº 1 · 1/3\n■□□\nrithmos.de');
    expect(shareText('2026-09-01', { solved: false, answers: [1, 2, 3] })).toBe('Rithmos Nº 1 · X/3\n■■■\nrithmos.de');
  });
});

describe('the feedback that teaches the rule', () => {
  it('names the steps, the factors, or the steps against the outer numbers', () => {
    expect(gapLine('arithmetic', 5, 8, 20)).toEqual({ left: '+3', right: '+12', match: false });
    expect(gapLine('arithmetic', 2, 4, 6)).toEqual({ left: '+2', right: '+2', match: true });
    expect(gapLine('geometric', 5, 10, 20)).toEqual({ left: '×2', right: '×2', match: true });
    expect(gapLine('geometric', 5, 8, 20)).toEqual({ left: '×1,6', right: '×2,5', match: false });
    expect(gapLine('musical', 6, 8, 12)).toEqual({ left: 'Schritte 1 : 2', right: 'außen 1 : 2', match: true });
    expect(gapLine('musical', 6, 9, 12)).toEqual({ left: 'Schritte 1 : 1', right: 'außen 1 : 2', match: false });
    expect(gapLine('arithmetic', 6, 8.7, 12).left).toBe('+2,7');
  });

  it('picks an example of the pattern that is not the puzzle itself', () => {
    expect(patternExample('arithmetic', 5, 20)).toEqual([2, 4, 6]);
    expect(patternExample('arithmetic', 2, 6)).toEqual([3, 5, 7]);
    expect(patternExample('musical', 6, 12)).toEqual([3, 4, 6]);
    expect(patternExample('geometric', 2, 8)).toEqual([3, 6, 12]);
  });
});
