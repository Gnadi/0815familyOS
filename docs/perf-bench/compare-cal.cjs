// Calendar correctness: month grid HTML while paging back, day agenda of a past day, and search results.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const profile of ['large', 'stale']) {
    const out = {};
    for (const port of [4341, 4342]) {
      const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
      await p.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
      await p.locator('input[type="email"]').fill(`${profile}-a@bench.test`); await p.locator('input[type="password"]').fill('bench-pass-123');
      await p.locator('form button[type="submit"]').click(); await p.waitForURL(/dashboard/);
      await p.goto(`http://127.0.0.1:${port}/calendar`);
      await p.waitForFunction(() => document.body.innerText.includes('BENCH-TODAY-EVENT'), null, { timeout: 60000 });
      const settle = async () => { await p.waitForFunction(() => !document.querySelector('.animate-spin') && !document.body.innerText.includes('Loading events'), null, { timeout: 60000 }); await p.waitForTimeout(800); };
      await settle();
      await p.getByRole('button', { name: /^Month$/ }).click(); await settle();
      const grids = [];
      for (let i = 0; i <= 26; i++) {
        if ([0, 1, 2, 3, 5, 8, 13, 26].includes(i)) {
          // tap the 10th of the month and capture grid + agenda
          await p.locator('main .grid-cols-7.gap-1 > *').filter({ hasText: /^10$/ }).first().click().catch(() => {});
          await settle();
          grids.push({ i, html: await p.locator('main').innerHTML() });
        }
        await p.getByRole('button', { name: 'Previous month' }).click(); await settle();
      }
      await p.locator('main input').first().fill('Past event 900'); await p.waitForTimeout(500); await settle();
      const search1 = await p.locator('main').innerText();
      await p.locator('main input').first().fill('BENCH-RECURRING'); await p.waitForTimeout(500); await settle();
      const search2 = (await p.locator('main').innerText()).slice(0, 2000);
      out[port] = { grids, search1, search2, errs };
      await ctx.close();
    }
    out[4341].grids.forEach((g, k) => {
      const same = g.html === out[4342].grids[k].html;
      const evs = (g.html.match(/Past event \d+|BENCH-[A-Z-]+/g) || []).length;
      console.log(profile, 'monthsBack', String(g.i).padStart(2), same ? 'IDENTICAL' : 'DIFFERENT', 'eventTitlesOnScreen', evs);
    });
    console.log(profile, 'search "Past event 900"', out[4341].search1 === out[4342].search1 ? 'IDENTICAL' : 'DIFFERENT', out[4342].search1.includes('Past event 900'));
    console.log(profile, 'search "BENCH-RECURRING"', out[4341].search2 === out[4342].search2 ? 'IDENTICAL' : 'DIFFERENT');
    console.log(profile, 'errors', out[4341].errs, out[4342].errs);
  }
  await b.close();
})().catch((e) => { console.log('FAILED', e.message); process.exit(1); });
