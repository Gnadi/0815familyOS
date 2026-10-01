import { describe, expect, it } from 'vitest';
import { moveId, resolveNavLayout, sanitizeBottomNav, toggleId } from '../../src/utils/navLayout';
import {
  BOTTOM_NAV_ENTRIES,
  BOTTOM_NAV_IDS,
  BOTTOM_NAV_MAX,
  DEFAULT_BOTTOM_NAV,
} from '../../src/constants/bottomNavEntries';

const BOTTOM = { allIds: ['home', 'calendar', 'meals', 'settings'], min: 2, max: 3, defaults: ['home', 'settings'] };
const QA = { allIds: ['vault', 'gifts', 'health'], defaults: ['vault'] };

const resolve = (stored, fallbackQuickAccess = ['gifts']) =>
  resolveNavLayout({ stored, fallbackQuickAccess, quickAccess: QA, bottomNav: BOTTOM });

describe('sanitizeBottomNav', () => {
  it('drops unknown ids and duplicates, keeping the order', () => {
    expect(sanitizeBottomNav(['meals', 'nope', 'meals', 'home'], BOTTOM)).toEqual(['meals', 'home']);
  });

  it('rejects lists below the minimum', () => {
    expect(sanitizeBottomNav(['home'], BOTTOM)).toBeNull();
    expect(sanitizeBottomNav('home', BOTTOM)).toBeNull();
  });

  it('caps lists at the maximum', () => {
    expect(sanitizeBottomNav(['home', 'calendar', 'meals', 'settings'], BOTTOM)).toEqual(['home', 'calendar', 'meals']);
  });
});

describe('resolveNavLayout', () => {
  it('uses the defaults and the device-local Quick Access when nothing is stored', () => {
    expect(resolve(undefined)).toEqual({ bottomNav: ['home', 'settings'], quickAccess: ['gifts'], customised: false });
  });

  it('uses the family layout once one is stored', () => {
    const r = resolve({ bottomNav: ['meals', 'home'], quickAccess: ['health'], quickAccessSeen: QA.allIds });
    expect(r).toEqual({ bottomNav: ['meals', 'home'], quickAccess: ['health'], customised: true });
  });

  it('keeps an emptied Quick Access empty', () => {
    expect(resolve({ quickAccess: [], quickAccessSeen: QA.allIds }).quickAccess).toEqual([]);
  });

  it('offers shortcuts added since the family last saved its list', () => {
    expect(resolve({ quickAccess: ['vault'], quickAccessSeen: ['vault', 'gifts'] }).quickAccess).toEqual(['vault', 'health']);
  });

  it('falls back to the default bar when the stored one is unusable', () => {
    expect(resolve({ bottomNav: ['nope'] }).bottomNav).toEqual(['home', 'settings']);
  });
});

describe('toggleId / moveId', () => {
  it('toggles an id in and out, appending at the end', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('moves within bounds and ignores moves past the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 'x', 1)).toEqual(['a', 'b']);
  });
});

describe('bottom nav catalogue', () => {
  it('has unique ids and a default within the limits', () => {
    expect(new Set(BOTTOM_NAV_IDS).size).toBe(BOTTOM_NAV_ENTRIES.length);
    expect(DEFAULT_BOTTOM_NAV.every((id) => BOTTOM_NAV_IDS.includes(id))).toBe(true);
    expect(DEFAULT_BOTTOM_NAV.length).toBeLessThanOrEqual(BOTTOM_NAV_MAX);
  });
});
