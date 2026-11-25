// Cold direct entry on /tasks: time until all open task cards exist, and until the archive is complete.
const { chromium } = require('playwright');
const fs = require('fs');
const [port, profile, runs, outFile] = [process.argv[2], process.argv[3], +process.argv[4], process.argv[5]];
const OPEN = { small: 2, medium: 20, large: 60 }[profile];
const DONE = { small: 18, medium: 180, large: 540 }[profile];
const opts = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' };
(async () => {
  const b = await chromium.launch();
  const l = await b.newContext(opts); const lp = await l.newPage();
  await lp.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await lp.locator('input[type="email"]').fill(`${profile}-a@bench.test`); await lp.locator('input[type="password"]').fill('bench-pass-123');
  await lp.locator('form button[type="submit"]').click(); await lp.waitForURL(/dashboard/);
  const st = await l.storageState({ indexedDB: true }); await l.close();
  for (const o of st.origins) { o.indexedDB = (o.indexedDB || []).filter((d) => d.name === 'firebaseLocalStorageDb'); o.localStorage = o.localStorage.filter((kv) => /auth|hint/i.test(kv.name)); }
  for (let r = 0; r < runs; r++) {
    const ctx = await b.newContext({ ...opts, storageState: st }); const p = await ctx.newPage();
    const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1e6, uploadThroughput: 187500 });
    await p.goto(`http://127.0.0.1:${port}/tasks`, { waitUntil: 'commit' });
    const res = await p.evaluate(([OPEN, DONE]) => new Promise((done) => {
      let tOpen = null;
      const tick = () => {
        const cards = document.querySelectorAll('main [aria-roledescription="draggable"]').length;
        if (tOpen === null && cards >= OPEN) tOpen = performance.now();
        const chip = [...document.querySelectorAll('main section h2')].find((h) => h.innerText === 'Completed')?.parentElement.querySelector('span')?.innerText;
        if (tOpen !== null && chip === String(DONE)) return requestAnimationFrame(() => requestAnimationFrame(() => done({ tOpen, tFull: performance.now(), dom: document.getElementsByTagName('*').length })));
        requestAnimationFrame(tick);
      };
      tick();
    }), [OPEN, DONE]);
    const row = { port, profile, run: r, tasksOpen: Math.round(res.tOpen), tasksFull: Math.round(res.tFull), dom: res.dom };
    fs.appendFileSync(outFile, JSON.stringify(row) + '\n'); console.log(JSON.stringify(row));
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
