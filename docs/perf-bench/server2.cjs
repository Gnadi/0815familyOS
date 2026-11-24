// Static server approximating Vercel: rewrites + headers from vercel.json,
// default Cache-Control "public, max-age=0, must-revalidate", ETag/304, gzip. HTTP/1.1.
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const [root, port] = [process.argv[2], +process.argv[3]];
const vercel = JSON.parse(fs.readFileSync(path.join(root, '..', 'vercel.json'), 'utf8'));
const toRe = (src) => new RegExp('^' + src.replace(/:(\w+)/g, '[^/]+') + '$');
const rules = (vercel.headers || []).map((h) => ({ re: toRe(h.source), headers: h.headers }));
const rewrites = (vercel.rewrites || []).filter((r) => !r.has).map((r) => ({ re: toRe(r.source), dest: r.destination }));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const cache = new Map();
function resolve(u) {
  let f = path.join(root, u);
  if (u === '/') return path.join(root, 'index.html');
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (fs.existsSync(path.join(f, 'index.html'))) return path.join(f, 'index.html');
  for (const r of rewrites) if (r.re.test(u)) return path.join(root, r.dest);
  return null;
}
let feedDelay = 0;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date()).replace(/-/g, "");
const ICS = (n) => ["BEGIN:VCALENDAR","VERSION:2.0","X-WR-CALNAME:Feed " + n,"BEGIN:VEVENT","UID:" + n + "-1@bench","DTSTAMP:20261101T000000Z","DTSTART:" + TODAY + "T080000Z","DTEND:" + TODAY + "T090000Z","SUMMARY:FEED-EVENT-" + n,"END:VEVENT","END:VCALENDAR"].join("\r\n");
http.createServer((q, r) => {
  if (q.url.startsWith("/__delay")) { feedDelay = +new URL(q.url, "http://x").searchParams.get("ms"); r.writeHead(200); return r.end("ok"); }
  if (q.url.startsWith("/api/ics-fetch")) { let body = ""; q.on("data", (c) => body += c); q.on("end", () => { const j = JSON.parse(body || "{}"); const n = /b\.ics/.test(j.url) ? "B" : "A"; const send = () => { r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify(j.etag ? { notModified: true, etag: j.etag } : { ics: ICS(n), etag: "\"v1\"" })); }; n === "B" && feedDelay ? setTimeout(send, feedDelay) : send(); }); return; }
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = resolve(u);
  if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let entry = cache.get(f);
  if (!entry) {
    const raw = fs.readFileSync(f);
    entry = { raw, gz: zlib.gzipSync(raw), etag: '"' + crypto.createHash('md5').update(raw).digest('hex') + '"' };
    cache.set(f, entry);
  }
  const h = { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate', etag: entry.etag };
  for (const rule of rules) if (rule.re.test(u)) for (const x of rule.headers) h[x.key.toLowerCase()] = x.value;
  if (q.headers['if-none-match'] === entry.etag) { r.writeHead(304, h); return r.end(); }
  const gz = /gzip/.test(q.headers['accept-encoding'] || '') && /text|javascript|json|svg|manifest/.test(h['content-type']);
  if (gz) h['content-encoding'] = 'gzip';
  r.writeHead(200, h); r.end(gz ? entry.gz : entry.raw);
}).listen(port, () => console.log('serving', root, 'on', port));
