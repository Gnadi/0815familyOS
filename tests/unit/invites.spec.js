// Unit tests for the pure helpers behind invite links. These run without the
// emulator (`npm test`); the rules suite needs `npm run test:rules`.

import { describe, expect, it } from 'vitest';
import { safeRedirect } from '../../src/utils/redirectTarget';
import {
  INVITE_TOKEN_RE,
  generateInviteToken,
  isValidInviteToken,
  looksLikeLegacyCode,
  normalizeInviteToken,
} from '../../src/utils/inviteToken';

describe('safeRedirect', () => {
  it('returns an internal path unchanged', () => {
    expect(safeRedirect({ pathname: '/join/abc' }, '/dashboard')).toBe('/join/abc');
  });

  it('keeps search and hash', () => {
    expect(safeRedirect({ pathname: '/join/abc', search: '?x=1', hash: '#y' }, '/dashboard')).toBe(
      '/join/abc?x=1#y',
    );
  });

  it('accepts a plain string path', () => {
    expect(safeRedirect('/calendar', '/dashboard')).toBe('/calendar');
  });

  // Protocol-relative URLs leave the origin — the classic open-redirect.
  it('rejects protocol-relative targets', () => {
    expect(safeRedirect({ pathname: '//evil.com' }, '/dashboard')).toBe('/dashboard');
    expect(safeRedirect('//evil.com/path', '/dashboard')).toBe('/dashboard');
  });

  it('rejects backslash tricks', () => {
    expect(safeRedirect('/\\evil.com', '/dashboard')).toBe('/dashboard');
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirect('https://evil.com', '/dashboard')).toBe('/dashboard');
    expect(safeRedirect({ pathname: 'https://evil.com' }, '/dashboard')).toBe('/dashboard');
  });

  it('refuses to bounce back into the auth pages', () => {
    expect(safeRedirect('/login', '/dashboard')).toBe('/dashboard');
    expect(safeRedirect('/signup', '/family-setup')).toBe('/family-setup');
    expect(safeRedirect('/login?next=1', '/dashboard')).toBe('/dashboard');
  });

  it('does not confuse a path that merely starts with the same letters', () => {
    expect(safeRedirect('/loginhelp', '/dashboard')).toBe('/loginhelp');
  });

  it('falls back on empty or malformed input', () => {
    expect(safeRedirect(undefined, '/dashboard')).toBe('/dashboard');
    expect(safeRedirect(null, '/dashboard')).toBe('/dashboard');
    expect(safeRedirect({}, '/dashboard')).toBe('/dashboard');
    expect(safeRedirect('', '/dashboard')).toBe('/dashboard');
  });
});

describe('invite tokens', () => {
  it('generates tokens that satisfy the shape the rules enforce', () => {
    for (let i = 0; i < 50; i += 1) {
      const token = generateInviteToken();
      expect(token).toMatch(INVITE_TOKEN_RE);
      // base64url of 16 bytes, padding stripped.
      expect(token).toHaveLength(22);
    }
  });

  it('generates distinct tokens', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateInviteToken()));
    expect(seen.size).toBe(200);
  });

  it('extracts the token from a pasted link', () => {
    expect(normalizeInviteToken('https://myfaos.app/join/AbC123_-xyz9876543210')).toBe(
      'AbC123_-xyz9876543210',
    );
    expect(normalizeInviteToken('  https://myfaos.app/join/tok?utm=x  ')).toBe('tok');
    expect(normalizeInviteToken('https://myfaos.app/join/tok#frag')).toBe('tok');
  });

  it('passes a bare token through', () => {
    expect(normalizeInviteToken('AbC123_-xyz9876543210')).toBe('AbC123_-xyz9876543210');
  });

  it('handles empty input', () => {
    expect(normalizeInviteToken('')).toBe('');
    expect(normalizeInviteToken(null)).toBe('');
    expect(normalizeInviteToken('   ')).toBe('');
  });

  it('rejects tokens that are too short or contain path separators', () => {
    expect(isValidInviteToken('short')).toBe(false);
    expect(isValidInviteToken('a/../families/fam2')).toBe(false);
    expect(isValidInviteToken('')).toBe(false);
    expect(isValidInviteToken(null)).toBe(false);
  });

  it('recognises the retired six-character codes', () => {
    expect(looksLikeLegacyCode('ABC123')).toBe(true);
    expect(looksLikeLegacyCode('abc123')).toBe(true);
    expect(looksLikeLegacyCode('DEMO42')).toBe(true);
    expect(looksLikeLegacyCode(generateInviteToken())).toBe(false);
    expect(looksLikeLegacyCode('ABC12')).toBe(false);
  });
});
