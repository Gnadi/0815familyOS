// CORS-friendly proxy that fetches a remote .ics URL and returns its body.
// Browsers can't fetch Google/iCloud secret-iCal feeds directly because they
// don't send permissive CORS headers, so this small server endpoint passes
// the body through. Parsing happens client-side.
//
// Conditional requests: the caller may pass the `etag` / `lastModified` it saw
// last. They are forwarded as If-None-Match / If-Modified-Since, and a 304 comes
// back as { notModified: true } with no body. Calendar feeds change rarely, so
// this is what keeps a re-sync from costing anything at all.
//
// Safety:
// - Only members of a family may use it (_lib/familyMember.js); it used to be
//   an open proxy for anyone who found the URL.
// - Only http, https and webcal schemes accepted (webcal → https).
// - Only the public internet: the address connected to is checked, for every
//   redirect too, so a name or a redirect pointing inside our own network is
//   refused (_lib/publicFetch.js).
// - 10s timeout, 8 MB max body.

import { verifyFamilyMember } from './_lib/familyMember.js';
import { fetchPublic } from './_lib/publicFetch.js';

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

const NOT_PUBLIC = 'Only calendars on the public internet can be subscribed to.';

function sanitiseUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let candidate = raw.trim();
  if (candidate.startsWith('webcal://')) {
    candidate = 'https://' + candidate.slice('webcal://'.length);
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  // fetch() refused credentials in the URL, so they never worked; now they are
  // refused up front rather than sent along as a login.
  if (parsed.username || parsed.password) return null;
  return parsed.toString();
}

// Validators are echoed back to an upstream server, so accept only plausible
// header values and cap their length.
function headerValue(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  // No CR/LF (header injection) and nothing outside printable ASCII.
  if (!/^[\x20-\x7E]+$/.test(trimmed)) return null;
  return trimmed;
}

function validatorsOf(response) {
  return {
    etag: response.headers.etag || null,
    lastModified: response.headers['last-modified'] || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const member = await verifyFamilyMember(req);
  if (!member.ok) {
    res.status(member.status).json({ error: member.error });
    return;
  }

  const raw = req.method === 'POST' ? req.body?.url : req.query?.url;
  const url = sanitiseUrl(raw);
  if (!url) {
    res.status(400).json({ error: 'Invalid or unsupported URL.' });
    return;
  }
  const etag = req.method === 'POST' ? headerValue(req.body?.etag) : null;
  const lastModified = req.method === 'POST' ? headerValue(req.body?.lastModified) : null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = {
      'User-Agent': 'myFAOS/1.0 (calendar subscription sync)',
      Accept: 'text/calendar, text/plain, */*',
    };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    const response = await fetchPublic(url, {
      headers,
      signal: controller.signal,
      maxBytes: MAX_BYTES,
    });
    // Unchanged since the caller last looked: no body, nothing to re-parse and
    // nothing to write.
    if (response.status === 304) {
      res.status(200).json({ notModified: true, etag, lastModified });
      return;
    }
    if (!response.body) {
      res.status(502).json({
        error: `Upstream returned ${response.status} ${response.statusText}`,
      });
      return;
    }
    res.status(200).json({ ics: response.body.toString('utf-8'), ...validatorsOf(response) });
  } catch (err) {
    if (controller.signal.aborted) {
      res.status(504).json({ error: 'Upstream timed out.' });
    } else if (err.code === 'not-public') {
      res.status(400).json({ error: NOT_PUBLIC });
    } else if (err.code === 'too-large') {
      res.status(413).json({ error: 'Calendar feed too large.' });
    } else {
      res.status(502).json({ error: err.message || 'Fetch failed.' });
    }
  } finally {
    clearTimeout(timeout);
  }
}
