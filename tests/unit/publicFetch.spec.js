// The calendar proxy's fetch, which must never reach into our own network.
// A local server stands in for the internet: the tests that need it to be
// reachable count 127.0.0.1 as public and resolve made-up hostnames themselves;
// the rest run with the real policy and the real DNS.

import http from 'node:http';
import zlib from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchPublic, isPublicAddress } from '../../api/_lib/publicFetch.js';

const CALENDAR = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';

let server;
let port;
let seen;

function route(req, res) {
  seen.push(req.url);
  const to = (location, status = 302) => {
    res.writeHead(status, { Location: location });
    res.end();
  };
  switch (req.url) {
    case '/feed.ics':
      res.writeHead(200, { 'Content-Type': 'text/calendar', ETag: '"v1"' });
      res.end(CALENDAR);
      break;
    case '/conditional.ics':
      if (req.headers['if-none-match'] === '"v1"') {
        res.writeHead(304);
        res.end();
      } else {
        res.writeHead(200, { ETag: '"v1"' });
        res.end(CALENDAR);
      }
      break;
    case '/gzip.ics':
      res.writeHead(200, { 'Content-Encoding': 'gzip' });
      res.end(zlib.gzipSync(CALENDAR));
      break;
    case '/bomb':
      // A few kilobytes on the wire, two megabytes once unpacked.
      res.writeHead(200, { 'Content-Encoding': 'gzip' });
      res.end(zlib.gzipSync(Buffer.alloc(2 * 1024 * 1024)));
      break;
    case '/big':
      res.writeHead(200);
      res.end(Buffer.alloc(2 * 1024 * 1024, 'a'));
      break;
    case '/missing':
      res.writeHead(404, 'Not Found');
      res.end('nope');
      break;
    case '/to-calendar':
      to(`http://calendar.test:${port}/feed.ics`, 301);
      break;
    case '/to-internal-name':
      to(`http://internal.test:${port}/feed.ics`);
      break;
    case '/to-internal-address':
      to('http://10.0.0.7/feed.ics');
      break;
    case '/to-loopback':
      to(`http://127.0.0.1:${port}/feed.ics`, 307);
      break;
    case '/to-file':
      to('file:///etc/passwd');
      break;
    case '/loop':
      to('/loop');
      break;
    case '/slow':
      break; // never answers
    case '/stall':
      res.writeHead(200);
      res.write('BEGIN:VCALENDAR\r\n'); // and never finishes
      break;
    default:
      res.writeHead(500);
      res.end();
  }
}

// The internet as these tests see it.
const DNS = {
  'calendar.test': ['127.0.0.1'],
  'internal.test': ['10.0.0.7'],
  'mixed.test': ['10.0.0.7', '127.0.0.1'],
};
function resolve(hostname, options, callback) {
  const addresses = DNS[hostname];
  if (!addresses) {
    callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }));
    return;
  }
  callback(null, addresses.map((address) => ({ address, family: 4 })));
}
const testNet = {
  resolve,
  isPublic: (address) => address === '127.0.0.1' || isPublicAddress(address),
};

beforeAll(async () => {
  server = http.createServer(route);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  port = server.address().port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
});

beforeEach(() => {
  seen = [];
});

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1', '127.8.8.8', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '::127.0.0.1',
    'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '64:ff9b::7f00:1', '2002:7f00:1::1',
    '2001::1', '2001:db8::1', 'localhost', 'not an address', '',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '8.8.8.8', '172.15.255.255', '172.32.0.1', '192.169.0.1', '100.128.0.1', '::ffff:8.8.8.8',
    '2606:4700:4700::1111', '2a00:1450:4001::200e',
  ])('lets through %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe('fetchPublic, as deployed', () => {
  it.each([
    ['an address in the URL', () => `http://127.0.0.1:${port}/feed.ics`],
    ['the same address written in hex', () => `http://0x7f.1:${port}/feed.ics`],
    ['an IPv6 address', () => `http://[::1]:${port}/feed.ics`],
    ['a name that resolves to it', () => `http://localhost:${port}/feed.ics`],
  ])('never connects to the server itself: %s', async (_, url) => {
    await expect(fetchPublic(url())).rejects.toMatchObject({ code: 'not-public' });
    expect(seen).toEqual([]);
  });
});

describe('fetchPublic, on the test network', () => {
  it('fetches a calendar, with its validators', async () => {
    const res = await fetchPublic(`http://calendar.test:${port}/feed.ics`, testNet);
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"v1"');
    expect(res.body.toString('utf-8')).toBe(CALENDAR);
  });

  it('passes the caller\'s headers on, for a conditional request', async () => {
    const res = await fetchPublic(`http://calendar.test:${port}/conditional.ics`, {
      ...testNet,
      headers: { 'If-None-Match': '"v1"' },
    });
    expect(res.status).toBe(304);
    expect(res.body).toBeNull();
  });

  it('unpacks a compressed calendar', async () => {
    const res = await fetchPublic(`http://calendar.test:${port}/gzip.ics`, testNet);
    expect(res.body.toString('utf-8')).toBe(CALENDAR);
  });

  it('reports an upstream error without its body', async () => {
    const res = await fetchPublic(`http://calendar.test:${port}/missing`, testNet);
    expect(res).toMatchObject({ status: 404, statusText: 'Not Found', body: null });
  });

  it('connects only to the public addresses of a name', async () => {
    const res = await fetchPublic(`http://mixed.test:${port}/feed.ics`, testNet);
    expect(res.status).toBe(200);
  });

  it('refuses a name that resolves only inside the network', async () => {
    await expect(fetchPublic(`http://internal.test:${port}/feed.ics`, testNet))
      .rejects.toMatchObject({ code: 'not-public' });
  });

  it('follows a redirect to another public address', async () => {
    const res = await fetchPublic(`http://calendar.test:${port}/to-calendar`, testNet);
    expect(res.body.toString('utf-8')).toBe(CALENDAR);
    expect(seen).toEqual(['/to-calendar', '/feed.ics']);
  });

  it.each([
    ['a name inside the network', '/to-internal-name'],
    ['an address inside the network', '/to-internal-address'],
  ])('does not follow a redirect to %s', async (_, path) => {
    await expect(fetchPublic(`http://calendar.test:${port}${path}`, testNet))
      .rejects.toMatchObject({ code: 'not-public' });
    expect(seen).toEqual([path]);
  });

  it('checks every redirect with the real policy too', async () => {
    // 127.0.0.1 is public only for the first hop here.
    let hops = 0;
    const firstHopOnly = { resolve, isPublic: (address) => (address === '127.0.0.1' && hops++ === 0) || isPublicAddress(address) };
    await expect(fetchPublic(`http://calendar.test:${port}/to-loopback`, firstHopOnly))
      .rejects.toMatchObject({ code: 'not-public' });
    expect(seen).toEqual(['/to-loopback']);
  });

  it('does not follow a redirect out of http and https', async () => {
    await expect(fetchPublic(`http://calendar.test:${port}/to-file`, testNet))
      .rejects.toMatchObject({ code: 'bad-redirect' });
  });

  it('gives up on a redirect loop', async () => {
    await expect(fetchPublic(`http://calendar.test:${port}/loop`, testNet))
      .rejects.toMatchObject({ code: 'too-many-redirects' });
    expect(seen).toHaveLength(6);
  });

  it('stops reading past the size limit', async () => {
    await expect(fetchPublic(`http://calendar.test:${port}/big`, { ...testNet, maxBytes: 1024 * 1024 }))
      .rejects.toMatchObject({ code: 'too-large' });
  });

  it('counts the size after unpacking', async () => {
    await expect(fetchPublic(`http://calendar.test:${port}/bomb`, { ...testNet, maxBytes: 1024 * 1024 }))
      .rejects.toMatchObject({ code: 'too-large' });
  });

  it.each(['/slow', '/stall'])('gives up when the caller does: %s', async (path) => {
    await expect(fetchPublic(`http://calendar.test:${port}${path}`, { ...testNet, signal: AbortSignal.timeout(100) }))
      .rejects.toThrow();
  });
});
