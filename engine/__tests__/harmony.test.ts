import { describe, expect, it } from 'vitest';
import { initialPosition, place, squareName } from '../board';
import type { PieceInput } from '../board';
import {
  findHarmonies,
  geometryOfFour,
  geometryOfThree,
  harmonyKey,
  harmonyKinds,
  harmonyKindsByMeans,
  harmonyKindsByMebben,
  harmonyKindsOfFour,
  reachableHarmonies,
  reachableHarmoniesBrute,
  victoryOf,
} from '../harmony';
import { harmonyApplications } from '../rules/applications';
import { moveToString } from '../moves';

describe('double recognition: Mebben conditions against the mean formulas', () => {
  it('corpus: 2/4/6 arithmetic, 5/10/20 geometric, 6/8/12 musical', () => {
    for (const fn of [harmonyKindsByMebben, harmonyKindsByMeans]) {
      expect(fn(2, 4, 6)).toEqual(['arithmetic']);
      expect(fn(5, 10, 20)).toEqual(['geometric']);
      expect(fn(6, 8, 12)).toEqual(['musical']);
      expect(fn(2, 4, 7)).toEqual([]);
      expect(fn(4, 2, 6)).toEqual([]); // not ascending
      expect(fn(4, 4, 4)).toEqual([]);
    }
  });

  it('agree on every ascending triple up to 400', () => {
    let harmonies = 0;
    for (let a = 1; a <= 400; a++)
      for (let b = a + 1; b <= 400; b++)
        for (let c = b + 1; c <= 400; c++) {
          const m = harmonyKindsByMebben(a, b, c);
          const n = harmonyKindsByMeans(a, b, c);
          if (m.join() !== n.join()) throw new Error(`disagree on ${a},${b},${c}: mebben=${m} means=${n}`);
          harmonies += m.length;
        }
    expect(harmonies).toBeGreaterThan(0);
  });

  it('a triple has at most one kind', () => {
    for (let a = 1; a <= 200; a++)
      for (let b = a + 1; b <= 200; b++)
        for (let c = b + 1; c <= 200; c++) {
          if (harmonyKinds(a, b, c).length > 1) throw new Error(`${a},${b},${c} has two kinds`);
        }
  });

  it('the application table names every kind with its classical example', () => {
    for (const app of harmonyApplications) {
      expect(harmonyKinds(...app.example)).toEqual([app.kind]);
    }
    expect(harmonyApplications.map((a) => a.kind)).toEqual(['arithmetic', 'geometric', 'musical']);
  });
});

describe('four values', () => {
  it('6, 8, 9, 12 carries all three harmonies', () => {
    expect(harmonyKindsOfFour([6, 8, 9, 12])).toEqual(['arithmetic', 'geometric', 'musical']);
  });
  it('2, 4, 6, 8 is arithmetic (2,4,6 and 4,6,8) and geometric (2,4,8)', () => {
    expect(harmonyKindsOfFour([2, 4, 6, 8])).toEqual(['arithmetic', 'geometric']);
  });
  it('2, 3, 4, 5 is arithmetic only', () => {
    expect(harmonyKindsOfFour([2, 3, 4, 5])).toEqual(['arithmetic']);
  });
  it('3, 4, 6, 8 is geometric (4-term) and musical (3,4,6) and arithmetic (4,6,8)', () => {
    expect(harmonyKindsOfFour([3, 4, 6, 8])).toEqual(['arithmetic', 'geometric', 'musical']);
  });
});

describe('geometry', () => {
  const sq = (n: string) => {
    const f = 'abcdefgh'.indexOf(n[0]!);
    return { file: f, rank: Number(n.slice(1)) - 1 };
  };
  it('line with equal spacing, any straight direction', () => {
    expect(geometryOfThree([sq('a1'), sq('c1'), sq('e1')])?.arrangement).toBe('line');
    expect(geometryOfThree([sq('c1'), sq('a1'), sq('e1')])?.order).toEqual([1, 0, 2]);
    expect(geometryOfThree([sq('a1'), sq('b2'), sq('c3')])?.arrangement).toBe('line');
    expect(geometryOfThree([sq('a1'), sq('b1'), sq('d1')])).toBeNull();
    expect(geometryOfThree([sq('a1'), sq('b3'), sq('c5')])).toBeNull(); // knight steps are not a line
  });
  it('right angle with equal legs, corner in the middle of the order', () => {
    const g = geometryOfThree([sq('a1'), sq('a3'), sq('c1')]);
    expect(g?.arrangement).toBe('angle');
    expect(g?.order[1]).toBe(0);
    expect(geometryOfThree([sq('b1'), sq('c2'), sq('d1')])?.arrangement).toBe('angle'); // diagonal legs
    expect(geometryOfThree([sq('a1'), sq('a3'), sq('d1')])).toBeNull(); // unequal legs
  });
  it('four in line, or a square, tilted or not', () => {
    expect(geometryOfFour([sq('a1'), sq('a3'), sq('a5'), sq('a7')])?.arrangement).toBe('line');
    expect(geometryOfFour([sq('a1'), sq('a3'), sq('c1'), sq('c3')])?.arrangement).toBe('square');
    expect(geometryOfFour([sq('b1'), sq('a2'), sq('c2'), sq('b3')])?.arrangement).toBe('square');
    expect(geometryOfFour([sq('a1'), sq('a3'), sq('c1'), sq('c4')])).toBeNull();
  });
});

describe('harmonies on the board', () => {
  it('minor victory: 2, 4, 6 in a row in the enemy half', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd10' },
    ]);
    const hs = findHarmonies(pos, 'white');
    expect(hs).toHaveLength(1);
    expect(hs[0]).toMatchObject({ pieces: ['a', 'b', 'c'], values: [2, 4, 6], kinds: ['arithmetic'], arrangement: 'line', victory: 'minor' });
    expect(victoryOf(pos, 'white')?.victory).toBe('minor');
    expect(victoryOf(pos, 'black')).toBeNull();
  });

  it('nothing counts in the own half', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b7' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c7' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd7' },
    ]);
    expect(findHarmonies(pos, 'white')).toEqual([]);
  });

  it('ascending order along the line is required, either direction', () => {
    const wrong = place([
      { id: 'a', side: 'white', shape: 'round', value: 4, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 2, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd10' },
    ]);
    expect(findHarmonies(wrong, 'white')).toEqual([]);
    const reversed = place([
      { id: 'a', side: 'white', shape: 'round', value: 6, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 2, at: 'd10' },
    ]);
    expect(findHarmonies(reversed, 'white')[0]?.pieces).toEqual(['c', 'b', 'a']);
  });

  it('equal spacing is required', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'e10' },
    ]);
    expect(findHarmonies(pos, 'white')).toEqual([]);
  });

  it('angle: the corner carries the middle value; geometric 5/10/20', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 5, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 10, at: 'b12' },
      { id: 'c', side: 'white', shape: 'round', value: 20, at: 'd12' },
    ]);
    const hs = findHarmonies(pos, 'white');
    expect(hs).toHaveLength(1);
    expect(hs[0]).toMatchObject({ kinds: ['geometric'], arrangement: 'angle', pieces: ['a', 'b', 'c'] });
    const cornerWrong = place([
      { id: 'a', side: 'white', shape: 'round', value: 10, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 5, at: 'b12' },
      { id: 'c', side: 'white', shape: 'round', value: 20, at: 'd12' },
    ]);
    expect(findHarmonies(cornerWrong, 'white')).toEqual([]);
  });

  it('black wins in white territory too: 6/8/12 musical on a diagonal', () => {
    const pos = place([
      { id: 'a', side: 'black', shape: 'round', value: 6, at: 'a1' },
      { id: 'b', side: 'black', shape: 'round', value: 8, at: 'b2' },
      { id: 'c', side: 'black', shape: 'round', value: 12, at: 'c3' },
    ]);
    expect(findHarmonies(pos, 'black')[0]).toMatchObject({ kinds: ['musical'], arrangement: 'line' });
  });

  it('major victory: four in a line with exactly two harmonies', () => {
    // 3, 4, 6, 8: (3,4,6) musical, (4,6,8) arithmetic, 3:4 = 6:8 geometric -> three kinds = greatest
    const greatest = place([
      { id: 'a', side: 'white', shape: 'round', value: 3, at: 'a9' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'b9' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'c9' },
      { id: 'd', side: 'white', shape: 'round', value: 8, at: 'd9' },
    ]);
    const hs = findHarmonies(greatest, 'white');
    expect(hs.map((h) => [h.victory, h.pieces.length])).toEqual(
      expect.arrayContaining([
        ['minor', 3],
        ['minor', 3],
        ['greatest', 4],
      ]),
    );
    expect(victoryOf(greatest, 'white')?.victory).toBe('greatest');
    // 2, 3, 4, 5 has one kind only: no four-piece victory, but 2/3/4 and 3/4/5 as minor ones
    const single = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a9' },
      { id: 'b', side: 'white', shape: 'round', value: 3, at: 'b9' },
      { id: 'c', side: 'white', shape: 'round', value: 4, at: 'c9' },
      { id: 'd', side: 'white', shape: 'round', value: 5, at: 'd9' },
    ]);
    expect(victoryOf(single, 'white')?.victory).toBe('minor');
    // 6, 8, 9, 12 in a square: all three kinds
    const square = place([
      { id: 'a', side: 'white', shape: 'round', value: 6, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 8, at: 'd10' },
      { id: 'c', side: 'white', shape: 'round', value: 9, at: 'b12' },
      { id: 'd', side: 'white', shape: 'round', value: 12, at: 'd12' },
    ]);
    expect(victoryOf(square, 'white')).toMatchObject({ victory: 'greatest', arrangement: 'square', values: [6, 8, 9, 12] });
    // 2, 4, 6, 9: (2,4,6) arithmetic, (4,6,9) geometric, exactly two -> major
    const major = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'a9' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'b9' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'c9' },
      { id: 'd', side: 'white', shape: 'round', value: 9, at: 'd9' },
    ]);
    expect(victoryOf(major, 'white')).toMatchObject({ victory: 'major', kinds: ['arithmetic', 'geometric'] });
  });
});

describe('reachable harmonies', () => {
  it('finds the one move that completes 2/4/6', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd11' },
    ]);
    const rs = reachableHarmonies(pos, 'white');
    expect(rs).toHaveLength(1);
    expect(rs[0]!.via.map(moveToString)).toEqual(['c d11-d10']);
    expect(rs[0]!.values).toEqual([2, 4, 6]);
  });

  it('a standing harmony is reachable in zero moves', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd10' },
    ]);
    expect(reachableHarmonies(pos, 'white', 0)[0]?.via).toEqual([]);
    expect(reachableHarmonies(pos, 'white', 1)).toHaveLength(1);
  });

  it('two moves away, counting own moves only', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c10' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd13' },
    ]);
    expect(reachableHarmonies(pos, 'white', 1)).toHaveLength(0);
    const two = reachableHarmonies(pos, 'white', 2);
    expect(two).toHaveLength(1);
    expect(two[0]!.via).toHaveLength(2);
  });

  it('the moving piece must land in the enemy half', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 2, at: 'b9' },
      { id: 'b', side: 'white', shape: 'round', value: 4, at: 'c9' },
      { id: 'c', side: 'white', shape: 'round', value: 6, at: 'd7' },
    ]);
    // c can move to d8 (own half): no harmony
    expect(reachableHarmonies(pos, 'white')).toHaveLength(0);
  });

  it('target-driven enumeration equals brute force on random positions', () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const values = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 27, 30, 36, 40, 45];
    const shapes = ['round', 'triangle', 'square'] as const;
    let totalReachable = 0;
    for (let trial = 0; trial < 60; trial++) {
      const inputs: PieceInput[] = [];
      const used = new Set<string>();
      const count = 10 + Math.floor(rnd() * 10);
      for (let i = 0; i < count; i++) {
        const side = rnd() < 0.7 ? 'white' : 'black';
        // white pieces mostly in the black half so harmonies are possible
        const rank = side === 'white' ? (rnd() < 0.8 ? 8 + Math.floor(rnd() * 6) : Math.floor(rnd() * 8)) : Math.floor(rnd() * 16);
        const file = Math.floor(rnd() * 8);
        const key = `${file},${rank}`;
        if (used.has(key)) continue;
        used.add(key);
        inputs.push({ id: `p${i}`, side, shape: shapes[Math.floor(rnd() * 3)]!, value: values[Math.floor(rnd() * values.length)]!, square: { file, rank } });
      }
      const pos = place(inputs);
      const fast = reachableHarmonies(pos, 'white', 1)
        .map((h) => `${harmonyKey(h.pieces)}@${h.via.map(moveToString).join(',')}`)
        .sort();
      const brute = reachableHarmoniesBrute(pos, 'white')
        .map((h) => `${harmonyKey(h.pieces)}@${h.via.map(moveToString).join(',')}`)
        .sort();
      // brute force may list the same harmony via several moves; the fast one keeps the shortest per piece set
      const bruteByKey = new Map<string, string[]>();
      for (const b of brute) {
        const [k, via] = b.split('@') as [string, string];
        bruteByKey.set(k, [...(bruteByKey.get(k) ?? []), via]);
      }
      for (const f of fast) {
        const [k, via] = f.split('@') as [string, string];
        expect(bruteByKey.get(k), `fast found ${f} that brute force did not`).toContain(via);
      }
      expect(new Set(fast.map((f) => f.split('@')[0])).size).toBe(bruteByKey.size);
      totalReachable += fast.length;
    }
    expect(totalReachable).toBeGreaterThan(0);
  });

  it('initial position: no harmony reachable in one move', () => {
    expect(reachableHarmonies(initialPosition(), 'white')).toEqual([]);
  });

  it('a pyramid may join a harmony on its total value', () => {
    const pos = place([
      { id: 'a', side: 'white', shape: 'round', value: 45, at: 'b10' },
      { id: 'b', side: 'white', shape: 'round', value: 68, at: 'c10' },
      { id: 'p', side: 'white', shape: 'pyramid', components: [{ value: 36, shape: 'square' }, { value: 25, shape: 'square' }, { value: 16, shape: 'triangle' }, { value: 9, shape: 'triangle' }, { value: 4, shape: 'round' }, { value: 1, shape: 'round' }], at: 'd11' },
    ]);
    const rs = reachableHarmonies(pos, 'white');
    expect(rs).toHaveLength(1);
    expect(rs[0]!.values).toEqual([45, 68, 91]);
    expect(squareName(rs[0]!.via[0]!.to)).toBe('d10');
    expect(rs[0]!.via[0]!.as).toBe('round');
  });
});
