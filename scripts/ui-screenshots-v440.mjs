// scripts/ui-screenshots-v440.mjs
// v4.4 修复验证截图: focus-visible + 暗色 muted 文本对比度

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT = 'ui-screenshots-v4.4';
const VIEWPORT = { width: 1440, height: 900 };

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

async function shoot(page, name, opts = {}) {
  await page.screenshot({ path: join(OUT, name), fullPage: false, ...opts });
  console.log(`📸 ${name}`);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // 1. Dashboard 浅色
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await shoot(page, '01-dashboard-light.png');

  // 2. Dashboard 暗色
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.waitForTimeout(400);
  await shoot(page, '02-dashboard-dark.png');

  // 3. Models 暗色 (看 muted 文本对比度)
  await page.goto(`${BASE}/#/models`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.waitForTimeout(800);
  await shoot(page, '03-models-dark.png');

  // 4. Settings 暗色 + 主题 radio (浅/深/跟随)
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.waitForTimeout(800);
  await shoot(page, '04-settings-dark.png');

  // 5. Chat 浅色 + 输入框 focus-visible
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  await page.goto(`${BASE}/#/chat`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  // 找任何 textarea / input,fallback 到 body
  const input = page.locator('textarea, input[type="text"]').first();
  const inputCount = await input.count();
  if (inputCount > 0) {
    await input.focus({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
  await shoot(page, '05-chat-input-focus.png');

  // 6. Chat 浅色 + Tab 走过所有可交互元素
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  await shoot(page, '06-chat-tab-focus.png');

  // 7. Models 暗色 + Tab focus 在 model-card
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.goto(`${BASE}/#/models`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // Tab 走过 SideNav 几次再到 model-card
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
  }
  await shoot(page, '07-models-dark-tab-focus.png');

  // 8. Skills 浅色 (新分组) - SkillsView
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  await page.goto(`${BASE}/#/skills`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await shoot(page, '08-skills-light.png');

  // 9. Sidebar 浅色
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // 触发 SideNav 展开
  await page.locator('aside.side-nav').hover();
  await page.waitForTimeout(400);
  await shoot(page, '09-sidenav-expanded.png');

  // 10. Chat 暗色 (整页)
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.goto(`${BASE}/#/chat`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await shoot(page, '10-chat-dark.png');

  // 11. Dashboard 浅色 + Cmd+K 命令面板
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // 触发命令面板
  await page.keyboard.press('Control+K');
  await page.waitForTimeout(500);
  await shoot(page, '11-command-palette.png');

  await browser.close();
  console.log('=== v4.4 验证截图完成 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
