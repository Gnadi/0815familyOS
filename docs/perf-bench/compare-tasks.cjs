const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const settled = () => !document.body.innerText.includes('Loading') && !/…/.test(document.querySelector('main')?.innerText || '') && document.body.innerText.includes('BENCH-TODAY-TASK');
  for (const profile of ['small', 'medium', 'large', 'stale']) {
    const out = {};
    for (const port of [4331, 4332]) {
      const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
      await p.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
      await p.locator('input[type="email"]').fill(`${profile}-a@bench.test`); await p.locator('input[type="password"]').fill('bench-pass-123');
      await p.locator('form button[type="submit"]').click(); await p.waitForURL(/dashboard/);
      await p.goto(`http://127.0.0.1:${port}/tasks`);
      await p.waitForFunction(settled, null, { timeout: 90000 }); await p.waitForTimeout(2000);
      const txt = async () => (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
      const collapsed = await txt();
      await p.evaluate(() => [...document.querySelectorAll('main button[aria-expanded]')].find((x) => /Completed/.test(x.innerText)).click());
      await p.waitForTimeout(1500);
      const expanded = await txt();
      await p.locator('main input').first().fill('Task 1'); await p.waitForTimeout(1500);
      const searched = await txt();
      out[port] = { collapsed, expanded, searched, errs };
      await ctx.close();
    }
    for (const k of ['collapsed', 'expanded', 'searched']) {
      const same = out[4331][k] === out[4332][k];
      console.log(profile.padEnd(7), k.padEnd(9), same ? 'IDENTICAL' : 'DIFFERENT', out[4332][k].length);
      if (!same) { console.log('  alt:', out[4331][k].slice(0, 400)); console.log('  neu:', out[4332][k].slice(0, 400)); }
    }
    if (out[4331].errs.length || out[4332].errs.length) console.log('  errors', out[4331].errs, out[4332].errs);
    if (profile === 'large') console.log('  sample:', out[4332].collapsed.slice(0, 300));
  }
  await b.close();
})().catch((e) => { console.log('FAILED', e.message); process.exit(1); });
