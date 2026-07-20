import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message));
page.on('console', (msg) => logs.push(`[${msg.type()}] ` + msg.text()));
page.on('requestfailed', (req) => logs.push('REQFAIL: ' + req.url() + ' ' + req.failure()?.errorText));
try {
  await page.goto('http://localhost:5173/#/d1-demo', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const root = await page.evaluate(() => {
    return {
      appHtml: (document.getElementById('app')?.innerHTML || '').slice(0, 1500),
      appText: (document.body.innerText || '').slice(0, 800),
      title: document.title,
      url: location.href,
      routeLinks: Array.from(document.querySelectorAll('a[href*="demo"]')).map((a) => a.getAttribute('href')),
    };
  });
  console.log('===ROOT===');
  console.log(JSON.stringify(root, null, 2));
  console.log('===LOGS===');
  console.log(logs.join('\n'));
} finally {
  await browser.close();
}
