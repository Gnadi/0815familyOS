import { describe, expect, it } from 'vitest';
import { resolveQuickAccess, sanitizeQuickAccess } from '../../src/utils/quickAccess';
import {
  DEFAULT_QUICK_ACCESS,
  LEGACY_QUICK_ACCESS_IDS,
  QUICK_ACCESS_ENTRIES,
  QUICK_ACCESS_IDS,
} from '../../src/constants/quickAccessEntries';

// Local fixtures rather than the real catalogue, so these stay meaningful when
// the shipped defaults change. 'tracker' is the newcomer; 'vault'/'gifts'/
// 'health' are what the imaginary older version knew about.
const ALL = ['vault', 'gifts', 'health', 'tracker'];
const LEGACY = ['vault', 'gifts', 'health'];
const DEFAULTS = ['tracker', 'vault', 'gifts'];

const resolve = (stored, seen) =>
  resolveQuickAccess({ stored, seen, allIds: ALL, defaults: DEFAULTS, legacyIds: LEGACY });

describe('sanitizeQuickAccess', () => {
  it('drops unknown ids and duplicates, keeping stored order', () => {
    expect(sanitizeQuickAccess(['gifts', 'nope', 'gifts', 'vault'], ALL)).toEqual(['gifts', 'vault']);
  });

  it('returns null for anything that is not an array', () => {
    expect(sanitizeQuickAccess(null, ALL)).toBeNull();
    expect(sanitizeQuickAccess('vault', ALL)).toBeNull();
  });
});

describe('resolveQuickAccess', () => {
  // The bug this exists for: a shortcut shipped after the user last touched
  // their list never appeared, because the stored array simply omits it.
  it('migrates a newly shipped shortcut into a pre-migration install', () => {
    // No `seen` record at all — the install predates the key.
    expect(resolve(['vault', 'gifts', 'health'], null)).toEqual([
      'vault',
      'gifts',
      'health',
      'tracker',
    ]);
  });

  it('gives a fresh install exactly the defaults, not the whole catalogue', () => {
    expect(resolve(null, null)).toEqual(DEFAULTS);
  });

  it('leaves a shortcut the user deliberately removed removed', () => {
    // 'gifts' is absent from the stored list but present in `seen`, so the
    // user has already been offered it and said no.
    expect(resolve(['vault', 'health'], ALL)).toEqual(['vault', 'health']);
  });

  it('is idempotent once everything has been offered', () => {
    const once = resolve(['vault'], LEGACY);
    expect(resolve(once, ALL)).toEqual(once);
  });

  it('preserves a user-chosen order rather than resorting to catalogue order', () => {
    expect(resolve(['health', 'vault'], ALL)).toEqual(['health', 'vault']);
  });

  it('does not duplicate a new shortcut the user already has', () => {
    expect(resolve(['tracker', 'vault'], LEGACY)).toEqual(['tracker', 'vault']);
  });

  it('recovers from a corrupted stored value', () => {
    expect(resolve('garbage', ALL)).toEqual(DEFAULTS);
  });
});

describe('quick access catalogue', () => {
  it('ships the tracker shortcut, so it reaches existing installs', () => {
    expect(QUICK_ACCESS_IDS).toContain('tracker');
    expect(DEFAULT_QUICK_ACCESS).toContain('tracker');
    // The whole migration hinges on 'tracker' being absent from the legacy
    // baseline — with it there, existing users would never be offered it.
    expect(LEGACY_QUICK_ACCESS_IDS).not.toContain('tracker');
  });

  it('has a legacy baseline drawn from the real catalogue', () => {
    for (const id of LEGACY_QUICK_ACCESS_IDS) {
      expect(QUICK_ACCESS_IDS).toContain(id);
    }
  });

  it('gives every default a real entry to render', () => {
    for (const id of DEFAULT_QUICK_ACCESS) {
      expect(QUICK_ACCESS_ENTRIES.find((e) => e.id === id)).toBeTruthy();
    }
  });

  it('migrates tracker into a real existing install', () => {
    // The exact case reported: the shipped defaults as they were, with no
    // seen record, must surface the Tracker shortcut.
    const resolved = resolveQuickAccess({
      stored: ['vault', 'gifts', 'health', 'shopping'],
      seen: null,
      allIds: QUICK_ACCESS_IDS,
      defaults: DEFAULT_QUICK_ACCESS,
      legacyIds: LEGACY_QUICK_ACCESS_IDS,
    });
    expect(resolved).toEqual(['vault', 'gifts', 'health', 'shopping', 'tracker']);
  });
});
