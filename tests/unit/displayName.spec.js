// Unit tests for the display-name normalizer shared by signup and the
// "change name" option in settings.

import { describe, expect, it } from 'vitest';
import { DISPLAY_NAME_MAX, normalizeDisplayName } from '../../src/utils/displayName';

describe('normalizeDisplayName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeDisplayName('  Sarah  ')).toBe('Sarah');
  });

  it('collapses inner whitespace, newlines included', () => {
    expect(normalizeDisplayName('Sarah   Maria\nMüller')).toBe('Sarah Maria Müller');
  });

  it('caps the length', () => {
    const long = 'a'.repeat(DISPLAY_NAME_MAX + 20);
    expect(normalizeDisplayName(long)).toHaveLength(DISPLAY_NAME_MAX);
  });

  it('returns an empty string for blank or missing input', () => {
    expect(normalizeDisplayName('   ')).toBe('');
    expect(normalizeDisplayName('')).toBe('');
    expect(normalizeDisplayName(null)).toBe('');
    expect(normalizeDisplayName(undefined)).toBe('');
  });

  it('leaves an already clean name untouched', () => {
    expect(normalizeDisplayName('Alex')).toBe('Alex');
  });
});
