// The app's side of the endpoints in api/: every call carries the signed-in
// user's ID token, which they now require, and nothing else gets it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizationHeader } = vi.hoisted(() => ({ authorizationHeader: vi.fn() }));
vi.mock('../../src/lib/firebase', () => ({ authorizationHeader }));

const ID_TOKEN_HEADER = { Authorization: 'Bearer id-token' };

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

let fetchMock;

beforeEach(() => {
  authorizationHeader.mockReset().mockResolvedValue(ID_TOKEN_HEADER);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('calendar feeds', () => {
  const subscription = { id: 'sub1', url: 'https://calendar.example/family.ics' };

  it('send the ID token to the feed proxy', async () => {
    const { loadFeed } = await import('../../src/services/calendarFeeds');
    fetchMock.mockResolvedValue(ok({ ics: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' }));

    await loadFeed(subscription, { force: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ics-fetch');
    expect(init.headers).toMatchObject({ ...ID_TOKEN_HEADER, 'Content-Type': 'application/json' });
  });

  it('are not fetched for nobody', async () => {
    const { loadFeed } = await import('../../src/services/calendarFeeds');
    authorizationHeader.mockRejectedValue(new Error('Sign in first.'));

    await expect(loadFeed(subscription, { force: true })).rejects.toThrow('Sign in first.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('document uploads', () => {
  it('ask for a signature with the ID token, and upload without it', async () => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'faos-test');
    vi.resetModules();
    const { uploadFile } = await import('../../src/services/cloudinary');
    fetchMock
      .mockResolvedValueOnce(ok({
        timestamp: 1, signature: 'sig', folder: 'familyos/documents', apiKey: 'key', resourceType: 'auto',
      }))
      .mockResolvedValueOnce(ok({ secure_url: 'https://res.cloudinary.com/faos-test/x.pdf', public_id: 'x' }));

    await uploadFile(new File(['%PDF-1.7'], 'Impfpass.pdf', { type: 'application/pdf' }));

    const [[signUrl, signInit], [uploadUrl, uploadInit]] = fetchMock.mock.calls;
    expect(signUrl).toBe('/api/cloudinary-sign');
    expect(signInit.headers).toEqual(ID_TOKEN_HEADER);
    expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/faos-test/auto/upload');
    expect(uploadInit.headers).toBeUndefined();
  });
});
