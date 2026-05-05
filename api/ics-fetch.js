// CORS-friendly proxy that fetches a remote .ics URL and returns its body.
// Browsers can't fetch Google/iCloud secret-iCal feeds directly because they
// don't send permissive CORS headers, so this small server endpoint passes
// the body through. Parsing happens client-side.
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

export default async function handler(req, res) {
  const raw = req.method === 'POST' ? req.body?.url : req.query?.url;
  const url = sanitiseUrl(raw);
  if (!url) {
    res.status(400).json({ error: 'Invalid or unsupported URL.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'FamilyOS/1.0 (calendar subscription sync)',
        Accept: 'text/calendar, text/plain, */*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
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
      res.status(200).json({ ics: text });
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
    res.status(200).json({ ics: merged.toString('utf-8') });
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
