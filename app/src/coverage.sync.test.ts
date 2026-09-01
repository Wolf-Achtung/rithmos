import { describe, expect, it } from 'vitest';
import { mergeRecords, newRecordId, withIds } from './coverage';

describe('coverage records across devices', () => {
  it('generates well-formed uuid v4 ids', () => {
    const id = newRecordId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newRecordId()).not.toBe(id);
  });

  it('gives legacy records an id and drops malformed ones', () => {
    const out = withIds([{ t: 1, coverage: 0.5, assist: 1 }, { coverage: 0.2 } as never, { id: 'keep', t: 2, coverage: 1, assist: 0, synced: true }]);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBeTruthy();
    expect(out[1]).toEqual({ id: 'keep', t: 2, coverage: 1, assist: 0, synced: true });
  });

  it('merges by id, marks remote as synced, sorts by time', () => {
    const local = [
      { id: 'a', t: 30, coverage: 0.5, assist: 1 },
      { id: 'b', t: 10, coverage: 1, assist: 2 },
    ];
    const remote = [
      { id: 'b', t: 10, coverage: 1, assist: 2, device: 'phone' },
      { id: 'c', t: 20, coverage: 0, assist: 0, device: 'tablet' },
    ];
    const merged = mergeRecords(local, remote);
    expect(merged.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(merged.find((r) => r.id === 'b')).toMatchObject({ synced: true, device: 'phone' });
    expect(merged.find((r) => r.id === 'a')!.synced).toBeUndefined();
  });
});
