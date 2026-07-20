import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ` + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message + '\n' + (e.stack || '')));
try {
  await page.goto('http://localhost:5173/#/d1-demo', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => ({
    app: document.getElementById('app')?.innerHTML.slice(0, 800),
    body: document.body.innerText.slice(0, 500),
  }));
  console.log('---HTML---');
  console.log(data.app);
  console.log('---TEXT---');
  console.log(data.body);
  console.log('---LOGS---');
  console.log(logs.join('\n'));
} finally {
  await browser.close();
}
