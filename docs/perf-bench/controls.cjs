// Control experiments from the review: (A) slow calendar provider, (B) housekeeping reads on direct entry,
// (C) completed-column re-open on the large board.
const { chromium } = require('playwright');
const [port, which] = [process.argv[2], process.argv[3]];
const BASE = `http://127.0.0.1:${port}`;
const ctxOpts = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' };
async function login(b, profile) {
  const ctx = await b.newContext(ctxOpts); const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.locator('input[type="email"]').fill(`${profile}-a@bench.test`);
  await p.locator('input[type="password"]').fill('bench-pass-123');
  await p.locator('form button[type="submit"]').click();
  await p.waitForURL(/dashboard/, { timeout: 60000 });
  const st = await ctx.storageState({ indexedDB: true }); await ctx.close();
  for (const o of st.origins) { o.indexedDB = (o.indexedDB || []).filter((d) => d.name === 'firebaseLocalStorageDb'); o.localStorage = o.localStorage.filter((kv) => /auth|hint/i.test(kv.name)); }
  return st;
}
const until = (page, src) => page.evaluate((src) => new Promise((res) => { const c = new Function('return (' + src + ')'); const t = () => { let ok = false; try { ok = c(); } catch {} ok ? requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now()))) : requestAnimationFrame(t); }; t(); }), src);

(async () => {
  const b = await chromium.launch();
  if (which === 'feed') {
    const st = await login(b, 'feed');
    for (const delay of [0, 2500, 10000]) {
      const times = [];
      for (let r = 0; r < 3; r++) {
        const ctx = await b.newContext({ ...ctxOpts, storageState: st });
        let p = await ctx.newPage();
        await fetch(`${BASE}/__delay?ms=0`);
        await p.goto(`${BASE}/calendar`, { waitUntil: 'commit' });
        await until(p, "document.body.innerText.includes('FEED-EVENT-B') && document.body.innerText.includes('BENCH-TODAY-EVENT')");
        await p.waitForTimeout(500);
        // Age every feed cache entry by two hours -> stale.
        await p.evaluate(() => { const old = Date.now() - 2 * 3600e3; for (const k of Object.keys(localStorage)) { if (!/^faos\.feed/.test(k)) continue; const v = localStorage.getItem(k); try { const j = JSON.parse(v); if (typeof j === 'number') localStorage.setItem(k, String(old)); else if (j && typeof j === 'object' && 'fetchedAt' in j) { j.fetchedAt = old; localStorage.setItem(k, JSON.stringify(j)); } } catch {} } });
        await p.close();
        await fetch(`${BASE}/__delay?ms=${delay}`);
        p = await ctx.newPage();
        let reqAt = null;
        p.on('request', (rq) => { if (rq.url().includes('/api/ics-fetch') && /b\.ics/.test(rq.postData() || '') && reqAt === null) reqAt = Date.now(); });
        const navAt = Date.now();
        await p.goto(`${BASE}/calendar`, { waitUntil: 'commit' });
        await until(p, "document.body.innerText.includes('BENCH-TODAY-EVENT') && !document.body.innerText.includes('Loading events')");
        const shownAt = Date.now();
        times.push({ fromNav: shownAt - navAt, fromFeedRequest: reqAt ? shownAt - reqAt : null });
        await ctx.close();
      }
      console.log(JSON.stringify({ port, test: 'feed', delay, times }));
    }
    await fetch(`${BASE}/__delay?ms=0`);
  }
  if (which === 'housekeeping') {
    const st = await login(b, 'large');
    const ctx = await b.newContext({ ...ctxOpts, storageState: st });
    const out = [];
    for (let s = 1; s <= 2; s++) {
      const p = await ctx.newPage();
      const c = await ctx.newCDPSession(p); await c.send('Network.enable');
      const ids = new Set(); let bytes = 0;
      c.on('Network.requestWillBeSent', (e) => { if (e.request.url.includes(':8080/')) ids.add(e.requestId); });
      c.on('Network.dataReceived', (e) => { if (ids.has(e.requestId)) bytes += e.dataLength; });
      await p.goto(`${BASE}/shopping`, { waitUntil: 'commit' });
      await p.waitForTimeout(8000);
      out.push({ session: s, firestoreBytes: bytes });
      await p.close();
    }
    console.log(JSON.stringify({ port, test: 'housekeeping-direct-shopping-large', out }));
  }
  if (which === 'board') {
    const st = await login(b, 'large');
    const ctx = await b.newContext({ ...ctxOpts, storageState: st }); const p = await ctx.newPage();
    const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(`${BASE}/tasks`, { waitUntil: 'commit' });
    await until(p, "document.body.innerText.includes('BENCH-TODAY-TASK')"); await p.waitForTimeout(3000);
    const res = [];
    const btn = "[...document.querySelectorAll('main button[aria-expanded]')].find((x) => /Completed/.test(x.innerText))";
    for (let i = 0; i < 4; i++) {
      // ensure collapsed first
      await p.evaluate((btn) => { const x = new Function('return ' + btn)(); if (x.getAttribute('aria-expanded') === 'true') x.click(); }, btn); await p.waitForTimeout(800);
      const domCollapsed = await p.evaluate(() => document.getElementsByTagName('*').length);
      const t = await p.evaluate((btn) => new Promise((res) => { const x = new Function('return ' + btn)(); const t0 = performance.now(); x.click(); requestAnimationFrame(() => requestAnimationFrame(() => res({ ms: performance.now() - t0, dom: document.getElementsByTagName('*').length }))); }), btn);
      res.push({ domCollapsed, domOpen: t.dom, ms: Math.round(t.ms) });
      await p.waitForTimeout(800);
    }
    console.log(JSON.stringify({ port, test: 'board-completed-reopen-large', res }));
  }
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
