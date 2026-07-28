const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const errs = [];
  page.on('console', msg => {
    if (msg.text().includes('Failed to resolve')) {
      const m = msg.text().match(/Failed to resolve component: ([\w-]+)/);
      if (m && !errs.includes(m[1])) errs.push(m[1]);
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('Dashboard unresolved:', errs.length, 'components');
  errs.forEach(e => console.log('  -', e));
  await browser.close();
})();
