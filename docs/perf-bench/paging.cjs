// Calendar month view: time per "previous month" step until the grid is settled (no spinner), cold context.
const { chromium } = require('playwright');
(async () => {
  const [port, profile] = [process.argv[2], process.argv[3]];
  const B = `http://127.0.0.1:${port}`;
  const opts = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' };
  const b = await chromium.launch();
  const l = await b.newContext(opts); const lp = await l.newPage();
  await lp.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await lp.locator('input[type="email"]').fill(`${profile}-a@bench.test`); await lp.locator('input[type="password"]').fill('bench-pass-123');
  await lp.locator('form button[type="submit"]').click(); await lp.waitForURL(/dashboard/);
  const st = await l.storageState({ indexedDB: true }); await l.close();
  for (const o of st.origins) { o.indexedDB = (o.indexedDB || []).filter((d) => d.name === 'firebaseLocalStorageDb'); o.localStorage = o.localStorage.filter((kv) => /auth|hint/i.test(kv.name)); }
  const runs = [];
  for (let r = 0; r < 3; r++) {
    const ctx = await b.newContext({ ...opts, storageState: st }); const p = await ctx.newPage();
    const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1e6, uploadThroughput: 187500 });
    const t0 = Date.now();
    await p.goto(`${B}/calendar`, { waitUntil: 'commit' });
    const settled = () => p.waitForFunction(() => document.body.innerText.includes('Month') && !document.querySelector('.animate-spin') && !document.body.innerText.includes('Loading events'), null, { timeout: 120000, polling: 'raf' });
    await p.waitForFunction(() => document.body.innerText.includes('BENCH-TODAY-EVENT'), null, { timeout: 120000, polling: 'raf' });
    const firstWeek = Date.now() - t0;
    await settled(); const calSettled = Date.now() - t0;
    await p.getByRole('button', { name: /^Month$/ }).click(); await settled();
    const steps = [];
    for (let i = 1; i <= 6; i++) {
      const s = Date.now();
      await p.getByRole('button', { name: 'Previous month' }).click();
      await p.waitForTimeout(50); await settled();
      steps.push(Date.now() - s);
    }
    runs.push({ firstWeek, calSettled, steps });
    await ctx.close();
  }
  console.log(JSON.stringify({ port, profile, runs }));
  await b.close();
})().catch((e) => { console.log('FAILED', e.message); process.exit(1); });
