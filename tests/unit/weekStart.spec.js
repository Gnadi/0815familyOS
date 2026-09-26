import { describe, expect, it } from 'vitest';
import { weekStart } from '../../src/utils/date';

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    // Friday, 2 Oct 2026 → Monday, 28 Sep 2026
    const d = weekStart(new Date(2026, 9, 2, 15, 30));
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(28);
    expect(d.getMonth()).toBe(8);
  });

  it('keeps a Sunday in the week that started the Monday before', () => {
    const d = weekStart(new Date(2026, 9, 4));
    expect(d.getDate()).toBe(28);
  });
});
