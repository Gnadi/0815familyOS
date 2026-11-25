const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const profile of ['small', 'medium', 'large', 'stale', 'feed']) {
    const texts = {};
    for (const port of [4321, 4322]) {
      const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
      await p.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
      await p.locator('input[type="email"]').fill(`${profile}-a@bench.test`); await p.locator('input[type="password"]').fill('bench-pass-123');
      await p.locator('form button[type="submit"]').click(); await p.waitForURL(/dashboard/);
      await p.waitForFunction(() => document.body.innerText.includes('BENCH-TODAY-EVENT') && document.body.innerText.includes('Last:'), null, { timeout: 90000 });
      await p.waitForTimeout(5000);
      texts[port] = (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
      if (errs.length) console.log(profile, port, 'ERRORS', errs.slice(0, 3));
      await ctx.close();
    }
    const same = texts[4321] === texts[4322];
    console.log(profile.padEnd(7), same ? 'IDENTICAL' : 'DIFFERENT');
    if (!same || profile === 'stale') { console.log('  alt:', texts[4321].slice(0, 700)); console.log('  neu:', texts[4322].slice(0, 700)); }
  }
  await b.close();
})();
