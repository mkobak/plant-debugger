/// <reference types="jest" />
import { describe, it, expect } from '@jest/globals';
import { entriesToEvict, MAX_HISTORY_ENTRIES } from '@/lib/history';

const entry = (id: string, createdAt: number) => ({ id, createdAt });

describe('entriesToEvict', () => {
  it('evicts nothing at or below the cap', () => {
    const entries = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) =>
      entry(`e${i}`, i)
    );
    expect(entriesToEvict(entries)).toEqual([]);
  });

  it('evicts the oldest entries beyond the cap', () => {
    const entries = [
      entry('newest', 300),
      entry('middle', 200),
      entry('oldest', 100),
    ];
    expect(entriesToEvict(entries, 2)).toEqual(['oldest']);
    expect(entriesToEvict(entries, 1)).toEqual(['middle', 'oldest']);
  });

  it('does not mutate the input order', () => {
    const entries = [entry('a', 1), entry('b', 2)];
    entriesToEvict(entries, 1);
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
