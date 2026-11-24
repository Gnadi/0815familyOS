// Dashboard -> Calendar, then time until an event from ~2.5 years ago is findable via search.
const { chromium } = require('playwright');
(async () => {
  const [port, profile, oldTitle] = [process.argv[2], process.argv[3], process.argv[4]];
  const B = `http://127.0.0.1:${port}`;
  const opts = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' };
  const b = await chromium.launch();
  const l = await b.newContext(opts); const lp = await l.newPage();
  await lp.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await lp.locator('input[type="email"]').fill(`${profile}-a@bench.test`); await lp.locator('input[type="password"]').fill('bench-pass-123');
  await lp.locator('form button[type="submit"]').click(); await lp.waitForURL(/dashboard/);
  const st = await l.storageState({ indexedDB: true }); await l.close();
  for (const o of st.origins) { o.indexedDB = (o.indexedDB || []).filter((d) => d.name === 'firebaseLocalStorageDb'); o.localStorage = o.localStorage.filter((kv) => /auth|hint/i.test(kv.name)); }
  const out = [];
  for (let r = 0; r < 3; r++) {
    const ctx = await b.newContext({ ...opts, storageState: st }); const p = await ctx.newPage();
    const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1e6, uploadThroughput: 187500 });
    await p.goto(`${B}/dashboard`, { waitUntil: 'commit' });
    await p.waitForFunction(() => document.body.innerText.includes('BENCH-TODAY-EVENT') && document.body.innerText.includes('Last:'), null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const t0 = Date.now();
    await p.locator('a[href="/calendar"]').first().click();
    await p.locator('main input').first().waitFor();
    await p.locator('main input').first().fill(oldTitle);
    await p.waitForFunction((t) => [...document.querySelectorAll('main *')].some((e) => e.childElementCount === 0 && e.textContent.trim() === t), oldTitle, { timeout: 120000 });
    out.push(Date.now() - t0);
    await ctx.close();
  }
  console.log(JSON.stringify({ port, profile, historySearchMs: out }));
  await b.close();
})();
