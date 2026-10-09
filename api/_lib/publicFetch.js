// Fetching a URL a family typed in, from inside our own network.
//
// The calendar proxy fetches whatever address a family subscribes to, so it
// must never be pointed at something only the server can reach: the host
// itself, the cloud provider's metadata and runtime endpoints, a private
// network. Checking the hostname as text, as the proxy used to, does not hold:
// a public name can resolve to 127.0.0.1, a redirect can lead anywhere, and
// fetch() followed redirects without asking. So the check is on the address
// actually connected to, when connecting:
//
// - every hostname is resolved by publicLookup, which hands the socket only
//   public addresses -- there is no second lookup for a DNS answer to change
//   in between;
// - an address written into the URL is checked before connecting, since the
//   socket would not look it up;
// - redirects are followed here, one by one, each through the same checks.

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { pipeline } from 'node:stream';
import zlib from 'node:zlib';

// Everything that is not the public internet, after IANA's special-purpose
// address registries. BlockList checks IPv4-mapped IPv6 addresses
// (::ffff:127.0.0.1) against the IPv4 entries itself.
const NOT_PUBLIC = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, where cloud metadata lives
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relays
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
]) {
  NOT_PUBLIC.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 96], // unspecified, loopback, IPv4-compatible
  ['::ffff:0:0:0', 96], // IPv4-translated
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48], // local NAT64
  ['100::', 64], // discard
  ['2001::', 23], // IETF protocol assignments, Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['3fff::', 20], // documentation
  ['5f00::', 16], // SRv6
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local
  ['ff00::', 8], // multicast
]) {
  NOT_PUBLIC.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (!family) return false;
  return !NOT_PUBLIC.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function refused(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

const DECODERS = {
  gzip: zlib.createGunzip,
  'x-gzip': zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress,
};

// A lookup for the socket that resolves as dns.lookup does and passes on only
// public addresses. Node asks for every address (`all`) when it races IPv4
// against IPv6, and for one otherwise.
function publicLookup(resolve, isPublic) {
  return (hostname, options, callback) => {
    resolve(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) {
        callback(err);
        return;
      }
      const usable = addresses.filter(({ address }) => isPublic(address));
      if (!usable.length) {
        callback(refused('not-public', `${hostname} is not on the public internet.`));
      } else if (options.all) {
        callback(null, usable);
      } else {
        callback(null, usable[0].address, usable[0].family);
      }
    });
  };
}

function send(url, { headers, signal, lookup, isPublic }) {
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal) && !isPublic(literal)) {
    return Promise.reject(refused('not-public', `${literal} is not on the public internet.`));
  }
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    // A connection of its own: a pooled socket could have been opened by a
    // request that did not go through these checks.
    const req = client.request(url, { headers, signal, lookup, agent: false }, resolve);
    req.on('error', reject);
    req.end();
  });
}

async function readBody(res, maxBytes) {
  const encoding = String(res.headers['content-encoding'] || 'identity').trim().toLowerCase();
  const decoder = DECODERS[encoding];
  if (!decoder && encoding !== 'identity') {
    res.destroy();
    throw refused('bad-encoding', `Unsupported content encoding: ${encoding}.`);
  }
  // An error on either end -- the caller's signal included, which destroys the
  // response -- ends the loop below, and leaving the loop destroys both.
  const body = decoder ? pipeline(res, decoder(), () => {}) : res;
  const chunks = [];
  let total = 0;
  for await (const chunk of body) {
    // Counted after decoding, so a small compressed body cannot unpack into
    // something far larger than the limit.
    total += chunk.length;
    if (total > maxBytes) throw refused('too-large', 'Response too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// GET `url`, following up to `maxRedirects` redirects. Resolves to
// { status, statusText, headers, body } -- `body` is a Buffer for a 2xx
// response and null otherwise. Rejects with `code` 'not-public',
// 'bad-redirect', 'too-many-redirects', 'too-large' or 'bad-encoding' for what
// it refuses, and with the network's own error for everything else.
//
// `resolve` and `isPublic` are there for the tests, which need a server on
// 127.0.0.1 to count as public.
export async function fetchPublic(rawUrl, {
  headers = {},
  signal,
  maxBytes = Infinity,
  maxRedirects = 5,
  resolve = dns.lookup,
  isPublic = isPublicAddress,
} = {}) {
  const lookup = publicLookup(resolve, isPublic);
  const requestHeaders = { 'Accept-Encoding': 'gzip, deflate, br', ...headers };
  let url = new URL(rawUrl);
  for (let redirects = 0; ; redirects += 1) {
    const res = await send(url, { headers: requestHeaders, signal, lookup, isPublic });
    const location = REDIRECTS.has(res.statusCode) ? res.headers.location : null;
    if (location) {
      res.destroy();
      if (redirects === maxRedirects) throw refused('too-many-redirects', 'Too many redirects.');
      let next;
      try {
        next = new URL(location, url);
      } catch {
        throw refused('bad-redirect', 'Redirected to an invalid URL.');
      }
      if ((next.protocol !== 'http:' && next.protocol !== 'https:') || next.username || next.password) {
        throw refused('bad-redirect', 'Redirected to an unsupported URL.');
      }
      url = next;
      continue;
    }
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    if (!ok) res.destroy();
    return {
      status: res.statusCode,
      statusText: res.statusMessage || '',
      headers: res.headers,
      body: ok ? await readBody(res, maxBytes) : null,
    };
  }
}
