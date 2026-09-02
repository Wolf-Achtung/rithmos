import { describe, expect, it } from 'vitest';
import { finds } from '../../../engine/rules/finds';
import { collection, foundIds } from './collection';

describe('the collection of finds', () => {
  it('counts a find once it was solved on the daily or in practice', () => {
    const ids = foundIds(
      [
        { solved: true, find: 'monochord' },
        { solved: false, find: 'villa-emo' },
        { solved: true },
      ],
      [
        { solved: true, find: 'f1-score' },
        { solved: true, find: 'monochord' },
      ],
    );
    expect([...ids].sort()).toEqual(['f1-score', 'monochord']);
    const c = collection(ids);
    expect(c.total).toBe(finds.length);
    expect(c.found.map((f) => f.id)).toEqual(finds.filter((f) => ids.has(f.id)).map((f) => f.id));
    expect(collection(new Set()).found).toEqual([]);
  });
});
