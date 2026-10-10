// The two endpoints in api/: nothing without membership, and what a member
// gets. Who counts as a member is tests/unit/familyMember.spec.js, what the
// feed proxy may reach is tests/unit/publicFetch.spec.js; both are stubbed here.

import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyFamilyMember, fetchPublic } = vi.hoisted(() => ({
  verifyFamilyMember: vi.fn(),
  fetchPublic: vi.fn(),
}));
vi.mock('../../api/_lib/familyMember.js', () => ({ verifyFamilyMember }));
vi.mock('../../api/_lib/publicFetch.js', () => ({ fetchPublic }));

import signUpload from '../../api/cloudinary-sign.js';
import fetchFeed from '../../api/ics-fetch.js';
import importRecipe from '../../api/recipe-import.js';

const MEMBER = { ok: true, uid: 'member-uid', familyId: 'fam1' };
const NOT_SIGNED_IN = { ok: false, status: 401, error: 'Sign in first.' };
const NOT_A_MEMBER = { ok: false, status: 403, error: 'Only members of a family can use this.' };
const CALENDAR = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';

function response() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  return res;
}

async function call(handler, req) {
  const res = response();
  await handler({ headers: {}, query: {}, ...req }, res);
  return res;
}

const feedRequest = (body) => ({ method: 'POST', body: { url: 'https://calendar.example/family.ics', ...body } });
const upstream = (status, { body = null, statusText = '', headers = {} } = {}) => ({
  status,
  statusText,
  headers,
  body: body === null ? null : Buffer.from(body),
});

beforeEach(() => {
  vi.stubEnv('CLOUDINARY_API_SECRET', 'cloudinary-secret');
  vi.stubEnv('CLOUDINARY_API_KEY', 'cloudinary-key');
  verifyFamilyMember.mockReset().mockResolvedValue(MEMBER);
  fetchPublic.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('api/cloudinary-sign', () => {
  it.each([
    ['without a session', NOT_SIGNED_IN],
    ['to someone outside a family', NOT_A_MEMBER],
  ])('signs nothing %s', async (_, refusal) => {
    verifyFamilyMember.mockResolvedValue(refusal);
    const res = await call(signUpload, {});
    expect(res.statusCode).toBe(refusal.status);
    expect(res.body).toEqual({ error: refusal.error });
  });

  it('signs an upload for a member of a family', async () => {
    const res = await call(signUpload, { query: { resource_type: 'raw' } });
    const { timestamp, signature, folder, apiKey, resourceType } = res.body;
    expect({ folder, apiKey, resourceType }).toEqual({
      folder: 'familyos/documents',
      apiKey: 'cloudinary-key',
      resourceType: 'raw',
    });
    expect(signature).toBe(
      createHash('sha1').update(`folder=familyos/documents&timestamp=${timestamp}cloudinary-secret`).digest('hex'),
    );
  });

  it('is never cached', async () => {
    expect((await call(signUpload, {})).headers['cache-control']).toBe('no-store');
  });
});

describe('api/ics-fetch', () => {
  it.each([
    ['without a session', NOT_SIGNED_IN],
    ['for someone outside a family', NOT_A_MEMBER],
  ])('fetches nothing %s', async (_, refusal) => {
    verifyFamilyMember.mockResolvedValue(refusal);
    const res = await call(fetchFeed, feedRequest());
    expect(res.statusCode).toBe(refusal.status);
    expect(fetchPublic).not.toHaveBeenCalled();
  });

  it('returns the feed with its validators', async () => {
    fetchPublic.mockResolvedValue(upstream(200, {
      body: CALENDAR,
      headers: { etag: '"v2"', 'last-modified': 'Fri, 09 Oct 2026 10:00:00 GMT' },
    }));
    const res = await call(fetchFeed, feedRequest());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ics: CALENDAR, etag: '"v2"', lastModified: 'Fri, 09 Oct 2026 10:00:00 GMT' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('asks upstream conditionally and passes a 304 on', async () => {
    fetchPublic.mockResolvedValue(upstream(304));
    const res = await call(fetchFeed, feedRequest({ etag: '"v1"', lastModified: 'Thu, 08 Oct 2026 10:00:00 GMT' }));
    expect(res.body).toEqual({ notModified: true, etag: '"v1"', lastModified: 'Thu, 08 Oct 2026 10:00:00 GMT' });
    expect(fetchPublic.mock.calls[0][1].headers).toMatchObject({
      'If-None-Match': '"v1"',
      'If-Modified-Since': 'Thu, 08 Oct 2026 10:00:00 GMT',
    });
  });

  it('turns webcal into https', async () => {
    fetchPublic.mockResolvedValue(upstream(200, { body: CALENDAR }));
    await call(fetchFeed, feedRequest({ url: 'webcal://calendar.example/family.ics' }));
    expect(fetchPublic.mock.calls[0][0]).toBe('https://calendar.example/family.ics');
  });

  it.each([
    'ftp://calendar.example/family.ics',
    'file:///etc/passwd',
    'not a url',
    'https://user:secret@calendar.example/family.ics',
  ])('refuses %s', async (url) => {
    const res = await call(fetchFeed, feedRequest({ url }));
    expect(res.statusCode).toBe(400);
    expect(fetchPublic).not.toHaveBeenCalled();
  });

  it('says so when a calendar is not on the public internet', async () => {
    fetchPublic.mockRejectedValue(Object.assign(new Error('nas.local is not on the public internet.'), { code: 'not-public' }));
    const res = await call(fetchFeed, feedRequest({ url: 'http://nas.local/family.ics' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Only calendars on the public internet can be subscribed to.');
  });

  it('reports an upstream error', async () => {
    fetchPublic.mockResolvedValue(upstream(404, { statusText: 'Not Found' }));
    const res = await call(fetchFeed, feedRequest());
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('Upstream returned 404 Not Found');
  });

  it('refuses a feed over the size limit', async () => {
    fetchPublic.mockRejectedValue(Object.assign(new Error('Response too large.'), { code: 'too-large' }));
    expect((await call(fetchFeed, feedRequest())).statusCode).toBe(413);
    expect(fetchPublic.mock.calls[0][1].maxBytes).toBe(8 * 1024 * 1024);
  });

  it('gives up after ten seconds', async () => {
    vi.useFakeTimers();
    fetchPublic.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const res = response();
    const pending = fetchFeed({ headers: {}, ...feedRequest() }, res);
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(res.statusCode).toBe(504);
  });
});

describe('api/recipe-import', () => {
  const recipeRequest = (url = 'https://cookidoo.de/recipes/recipe/de-DE/r59322') => ({ method: 'POST', body: { url } });
  const RECIPE_PAGE = '<script type="application/ld+json">'
    + JSON.stringify({ '@type': 'Recipe', name: 'Brötchen', recipeYield: '12 Stück', recipeIngredient: ['400 g Mehl'] })
    + '</script>';

  it.each([
    ['without a session', NOT_SIGNED_IN],
    ['for someone outside a family', NOT_A_MEMBER],
  ])('fetches nothing %s', async (_, refusal) => {
    verifyFamilyMember.mockResolvedValue(refusal);
    const res = await call(importRecipe, recipeRequest());
    expect(res.statusCode).toBe(refusal.status);
    expect(fetchPublic).not.toHaveBeenCalled();
  });

  it('returns the recipe on the page, not the page', async () => {
    fetchPublic.mockResolvedValue(upstream(200, { body: RECIPE_PAGE }));
    const res = await call(importRecipe, recipeRequest());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      recipe: {
        title: 'Brötchen',
        ingredients: ['400 g Mehl'],
        instructions: [],
        servings: 12,
        category: null,
        sourceUrl: 'https://cookidoo.de/recipes/recipe/de-DE/r59322',
      },
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('adds https to a link pasted without it', async () => {
    fetchPublic.mockResolvedValue(upstream(200, { body: RECIPE_PAGE }));
    await call(importRecipe, recipeRequest('www.chefkoch.de/rezepte/1/x.html'));
    expect(fetchPublic.mock.calls[0][0]).toBe('https://www.chefkoch.de/rezepte/1/x.html');
  });

  it('says so when the page has no recipe', async () => {
    fetchPublic.mockResolvedValue(upstream(200, { body: '<html>Hallo</html>' }));
    const res = await call(importRecipe, recipeRequest());
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('no-recipe');
  });

  it('passes an upstream error on', async () => {
    fetchPublic.mockResolvedValue(upstream(404, { body: 'gone', statusText: 'Not Found' }));
    expect((await call(importRecipe, recipeRequest())).statusCode).toBe(502);
  });

  it.each([
    'ftp://cookidoo.de/recipe',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:secret@cookidoo.de/recipe',
  ])('refuses %s', async (url) => {
    const res = await call(importRecipe, recipeRequest(url));
    expect(res.statusCode).toBe(400);
    expect(fetchPublic).not.toHaveBeenCalled();
  });

  it('refuses a page inside our own network', async () => {
    fetchPublic.mockRejectedValue(Object.assign(new Error('not public'), { code: 'not-public' }));
    expect((await call(importRecipe, recipeRequest('http://169.254.169.254/'))).statusCode).toBe(400);
  });
});
