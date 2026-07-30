// V4.4 真 app Settings 截图 — 验证 v4.4 完整设计语言 (2 列 grid + setting-row)
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'ui-screenshots-v4.4-real-settings';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TABS = [
  { key: 'basic', name: '01-basic', wait: 400 },
  { key: 'models', name: '02-models', wait: 800 },
  { key: 'mcp', name: '03-mcp', wait: 500 },
  { key: 'memory', name: '04-memory', wait: 400 },
  { key: 'about', name: '05-about', wait: 500 }
];

const THEMES = ['light', 'dark'];

(async () => {
  const browser = await chromium.launch();
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/#/settings', { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      const root = document.documentElement;
      root.setAttribute('data-theme', t);
    }, theme);
    await page.waitForTimeout(500);

    for (const tab of TABS) {
      await page.locator(`#settings-tab-${tab.key}`).click();
      await page.waitForTimeout(tab.wait);
      const file = join(OUT, `${theme}-${tab.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`✓ ${file}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
