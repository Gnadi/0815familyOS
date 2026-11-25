const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 1400 }, locale: 'en-US', timezoneId: 'Europe/Vienna', serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  await p.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await p.locator('input[type="email"]').fill('stale-a@bench.test'); await p.locator('input[type="password"]').fill('bench-pass-123');
  await p.locator('form button[type="submit"]').click(); await p.waitForURL(/dashboard/);
  await p.goto(`http://127.0.0.1:${port}/tasks`);
  await p.waitForFunction(() => !document.body.innerText.includes('Loading') && document.body.innerText.includes('BENCH-TODAY-TASK'), null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const counts = () => p.evaluate(() => [...document.querySelectorAll('main section h2')].map((h) => h.innerText + '=' + h.parentElement.querySelector('span')?.innerText).join(' '));
  const score = () => p.evaluate(() => (document.querySelector('main').innerText.match(/\d+%/) || [''])[0]);
  const occ = () => p.evaluate(() => document.querySelector('main').innerText.split('BENCH-TODAY-TASK').length - 1);
  async function drag(targetHeading) {
    const card = await p.getByText('BENCH-TODAY-TASK').first().boundingBox();
    const target = await p.locator('main section h2', { hasText: targetHeading }).first().boundingBox();
    await p.mouse.move(card.x + 20, card.y + 5); await p.mouse.down();
    for (let i = 1; i <= 20; i++) { await p.mouse.move(card.x + 20, card.y + 5 + ((target.y + 5 - card.y - 5) * i) / 20); await p.waitForTimeout(20); }
    await p.mouse.up(); await p.waitForTimeout(2500);
  }
  console.log(port, 'before:     ', await counts(), await score(), 'occ', await occ());
  await drag('Completed');
  console.log(port, 'completed:  ', await counts(), await score(), 'occ', await occ());
  await p.evaluate(() => [...document.querySelectorAll('main button[aria-expanded]')].find((x) => /Completed/.test(x.innerText)).click());
  await p.waitForTimeout(800);
  await drag('Planned');
  console.log(port, 'reopened:   ', await counts(), await score(), 'occ', await occ());
  console.log(port, 'errors:', errs.length ? errs : 'none');
  await b.close();
})().catch((e) => { console.log('FAILED', e.message); process.exit(1); });
