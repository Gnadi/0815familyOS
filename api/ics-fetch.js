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
// - Only http, https and webcal schemes accepted (webcal → https).
// - Hostnames matching private/loopback patterns rejected to prevent SSRF.
// - 10s timeout, 8 MB max body.

const PRIVATE_HOSTNAMES = /^(?:localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|fd|fc|fe80)/i;
const PRIVATE_172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./;
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

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
  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.test(host) || PRIVATE_172.test(host)) return null;
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
    etag: response.headers.get('etag') || null,
    lastModified: response.headers.get('last-modified') || null,
  };
}

export default async function handler(req, res) {
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

    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    // Unchanged since the caller last looked: no body, nothing to re-parse and
    // nothing to write.
    if (response.status === 304) {
      res.status(200).json({ notModified: true, etag, lastModified });
      return;
    }
    if (!response.ok) {
      res.status(502).json({
        error: `Upstream returned ${response.status} ${response.statusText}`,
      });
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (text.length > MAX_BYTES) {
        res.status(413).json({ error: 'Calendar feed too large.' });
        return;
      }
      res.status(200).json({ ics: text, ...validatorsOf(response) });
      return;
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        res.status(413).json({ error: 'Calendar feed too large.' });
        return;
      }
      chunks.push(value);
    }
    const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    res.status(200).json({ ics: merged.toString('utf-8'), ...validatorsOf(response) });
  } catch (err) {
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Upstream timed out.' });
    } else {
      res.status(502).json({ error: err.message || 'Fetch failed.' });
    }
  } finally {
    clearTimeout(timeout);
  }
}
