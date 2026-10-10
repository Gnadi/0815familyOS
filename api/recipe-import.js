// Fetches a recipe page and returns the recipe it describes, for the "import
// from link" button in the recipe form. Browsers can't read other sites' pages
// (no CORS), so the page is fetched here and read with _lib/recipeSchema.js.
//
// Works for any site that publishes schema.org/Recipe data -- Cookidoo,
// Chefkoch and most others. Cookidoo keeps its steps behind its login, so an
// import from there has title, ingredients and yield but no steps.
//
// Safety, as for the calendar proxy (ics-fetch.js):
// - Only members of a family may use it (_lib/familyMember.js).
// - Only http and https, and only the public internet, redirects included
//   (_lib/publicFetch.js).
// - 10s timeout, 4 MB max page. Only the parsed recipe goes back, never the page.

import { verifyFamilyMember } from './_lib/familyMember.js';
import { fetchPublic } from './_lib/publicFetch.js';
import { parseRecipeFromHtml } from './_lib/recipeSchema.js';

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function sanitiseUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let candidate = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  return parsed.toString();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const member = await verifyFamilyMember(req);
  if (!member.ok) {
    res.status(member.status).json({ error: member.error });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  const url = sanitiseUrl(req.body?.url);
  if (!url) {
    res.status(400).json({ error: 'Invalid or unsupported URL.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetchPublic(url, {
      headers: {
        'User-Agent': 'myFAOS/1.0 (recipe import)',
        Accept: 'text/html, application/xhtml+xml',
        // Cookidoo and others pick the page's language from this; without it
        // some answer with a country chooser instead of the recipe.
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      maxBytes: MAX_BYTES,
    });
    if (response.status < 200 || response.status >= 300 || !response.body) {
      // 401/403/429: the site turned the server away (bot protection), which
      // the form tells apart from a page that isn't there.
      const blocked = [401, 403, 429].includes(response.status);
      res.status(502).json({
        error: `Upstream returned ${response.status} ${response.statusText}`.trim(),
        code: blocked ? 'blocked' : 'upstream',
      });
      return;
    }
    const recipe = parseRecipeFromHtml(response.body.toString('utf-8'));
    if (!recipe) {
      res.status(422).json({ error: 'No recipe found on this page.', code: 'no-recipe' });
      return;
    }
    res.status(200).json({ recipe: { ...recipe, sourceUrl: url } });
  } catch (err) {
    if (controller.signal.aborted) {
      res.status(504).json({ error: 'Upstream timed out.' });
    } else if (err.code === 'not-public') {
      res.status(400).json({ error: 'Only pages on the public internet can be imported.' });
    } else if (err.code === 'too-large') {
      res.status(413).json({ error: 'Page too large.' });
    } else {
      res.status(502).json({ error: err.message || 'Fetch failed.' });
    }
  } finally {
    clearTimeout(timeout);
  }
}
