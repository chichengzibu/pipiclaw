// scripts/ui-screenshots-v440-real.mjs
// v4.4 真界面验证截图 (light + dark + focus)
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT = 'ui-screenshots-v4.4-real';
const VIEWPORT = { width: 1440, height: 900 };

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

async function shoot(page, name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log(`📸 ${name}`);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // 1. Dashboard 浅色
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shoot(page, '01-dashboard-light.png');

  // 2. Dashboard 暗色
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.waitForTimeout(500);
  await shoot(page, '02-dashboard-dark.png');

  // 3. Chat 暗色
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.goto(`${BASE}/#/chat`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shoot(page, '03-chat-dark.png');

  // 4. Models 暗色 (provider-card active 态)
  await page.goto(`${BASE}/#/models`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shoot(page, '04-models-dark.png');

  // 5. Settings 暗色
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shoot(page, '05-settings-dark.png');

  // 6. Skills 浅色
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  await page.goto(`${BASE}/#/skills`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shoot(page, '06-skills-light.png');

  // 7. Dashboard 浅色 + focus
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await shoot(page, '07-dashboard-tab-focus.png');

  // 8. Settings 暗色 + focus
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await shoot(page, '08-settings-dark-tab-focus.png');

  await browser.close();
  console.log('=== v4.4 真界面验证截图完成 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
