// Debug: 实际 Settings nav DOM 结构
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/#/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const html = await page.evaluate(() => {
    const nav = document.querySelector('.settings-nav');
    if (!nav) return 'NO .settings-nav found';
    return nav.outerHTML;
  });
  console.log('=== .settings-nav HTML ===');
  console.log(html);

  const buttons = await page.locator('.settings-nav__btn').count();
  console.log(`\n=== .settings-nav__btn count: ${buttons} ===`);

  for (let i = 0; i < buttons; i++) {
    const text = await page.locator('.settings-nav__btn').nth(i).textContent();
    const cls = await page.locator('.settings-nav__btn').nth(i).getAttribute('class');
    console.log(`  [${i}] class="${cls}" text="${text}"`);
  }

  // 测试选择器
  const foundZh = await page.locator('.settings-nav__btn:has-text("模型管理")').count();
  const foundEn = await page.locator('.settings-nav__btn:has-text("Models")').count();
  console.log(`\n=== selector .settings-nav__btn:has-text("模型管理") count: ${foundZh} ===`);
  console.log(`=== selector .settings-nav__btn:has-text("Models") count: ${foundEn} ===`);

  await browser.close();
})();
