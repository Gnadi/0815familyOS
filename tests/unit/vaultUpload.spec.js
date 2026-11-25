import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/firebase', () => ({ authorizationHeader: vi.fn() }));

const { MAX_SIZE_BYTES, validateFile } = await import('../../src/services/cloudinary');

// The vault encrypts in memory (about 3-4x the file size) and uploads in one
// request, so the limit has to stay far below what a phone tab or a single
// Cloudinary request can take.
describe('vault upload limit', () => {
  const file = (size, name = 'scan.pdf') => ({ size, name });

  it('stays at a size a phone can encrypt in memory', () => {
    expect(MAX_SIZE_BYTES).toBeLessThanOrEqual(100 * 1024 * 1024);
  });

  it('accepts a file at the limit', () => {
    expect(() => validateFile(file(MAX_SIZE_BYTES))).not.toThrow();
  });

  it('rejects a file one byte over, by size alone (before reading it)', () => {
    expect(() => validateFile(file(MAX_SIZE_BYTES + 1))).toThrow(
      expect.objectContaining({ code: 'file/too-large' }),
    );
  });
});
