// Replicates the review's browser series: Chromium, 393x852, DPR 2, 4x CPU throttle,
// 60 ms latency / 8 Mbit down / 1.5 Mbit up, SW blocked, fresh context per cold run.
const { chromium } = require('playwright');
const fs = require('fs');
const [port, profile, runs, outFile] = [process.argv[2], process.argv[3], +process.argv[4], process.argv[5]];
const BASE = `http://127.0.0.1:${port}`;
const ctxOpts = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' };

async function throttle(page) {
  const c = await page.context().newCDPSession(page);
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await c.send('Network.enable');
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1e6, uploadThroughput: 187500 });
  return c;
}
// Resolves with performance.now() once cond holds, plus two animation frames.
const waitFor = (page, condSrc, extra = '') => page.evaluate(([condSrc, extra]) => new Promise((res) => {
  const cond = new Function('return (' + condSrc + ')');
  const t0 = performance.now();
  if (extra) new Function(extra)();
  const tick = () => { let ok = false; try { ok = cond(); } catch {} ok ? requestAnimationFrame(() => requestAnimationFrame(() => res({ t: performance.now(), t0, dom: document.getElementsByTagName('*').length }))) : requestAnimationFrame(tick); };
  tick();
}), [condSrc, extra]);
const txt = () => "document.body.innerText";
const DASH = `${txt()}.includes('BENCH-TODAY-EVENT') && ${txt()}.includes('BENCH-TODAY-TASK') && ${txt()}.includes('Last:') && ${txt()}.includes('Upcoming Vaccination')`;
const nav = (to) => `const a = document.querySelector('a[href="${to}"]'); if (a) a.click(); else { history.pushState({}, '', '${to}'); dispatchEvent(new PopStateEvent('popstate')); }`;

(async () => {
  const b = await chromium.launch();
  // One login through the form; keep only the Firebase Auth state + auth hint.
  const lctx = await b.newContext(ctxOpts); const lp = await lctx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await lp.locator('input[type="email"]').fill(`${profile}-a@bench.test`);
  await lp.locator('input[type="password"]').fill('bench-pass-123');
  await lp.locator('form button[type="submit"]').click();
  await lp.waitForURL(/dashboard/, { timeout: 60000 });
  const state = await lctx.storageState({ indexedDB: true });
  await lctx.close();
  for (const o of state.origins) {
    o.indexedDB = (o.indexedDB || []).filter((db) => db.name === 'firebaseLocalStorageDb');
    o.localStorage = o.localStorage.filter((kv) => /auth|hint/i.test(kv.name));
  }
  const results = [];
  for (let r = 0; r < runs; r++) {
    const ctx = await b.newContext({ ...ctxOpts, storageState: state });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await throttle(page);
    const res = { profile, run: r };
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'commit' });
    res.dashCold = (await waitFor(page, DASH)).t;
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'commit' });
    res.dashWarm = (await waitFor(page, DASH)).t;
    await page.waitForTimeout(1500);
    let m = await waitFor(page, `location.pathname === '/calendar' && ${txt()}.includes('BENCH-TODAY-EVENT')`, nav('/calendar'));
    res.toCalendar = m.t - m.t0;
    await page.waitForTimeout(1000);
    m = await waitFor(page, `[...document.querySelectorAll('main .grid-cols-7.gap-1')].some((g) => g.children.length >= 28)`,
      `[...document.querySelectorAll('main button')].find((x) => x.innerText.trim() === 'Month').click()`);
    res.weekToMonth = m.t - m.t0;
    await page.waitForTimeout(1000);
    m = await waitFor(page, `location.pathname === '/tasks' && ${txt()}.includes('BENCH-TODAY-TASK')`, nav('/tasks'));
    res.toTasks = m.t - m.t0; res.domTasks = m.dom;
    const tFull = await page.evaluate(() => new Promise((res) => { const ok = () => !document.body.innerText.includes('Loading') && !/…/.test(document.querySelector('main').innerText) && /\d+%/.test(document.querySelector('main').innerText); const t = () => ok() ? requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now()))) : requestAnimationFrame(t); t(); }));
    res.toTasksFull = tFull - m.t0;
    await page.waitForTimeout(1500);
    res.domTasksSettled = await page.evaluate(() => document.getElementsByTagName('*').length);
    res.errors = errs.length;
    results.push(res);
    fs.appendFileSync(outFile, JSON.stringify({ port, ...res }) + '\n');
    console.log(JSON.stringify(res));
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
