// scripts/ui-screenshots.mjs
// 临时 UI 截图脚本 — 验证 v4.3.x UI 修复视觉效果
// 用法: node scripts/ui-screenshots.mjs
// 前置: npm run dev (端口 5173)

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT = 'ui-screenshots-v4.3';
const VIEWPORT = { width: 1440, height: 900 };

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const ROUTES = [
  { path: '/dashboard', name: '01-dashboard' },
  { path: '/chat', name: '02-chat' },
  { path: '/skills', name: '03-skills' },
  { path: '/models', name: '04-models' },
  { path: '/im-management', name: '05-im-management' },
  { path: '/settings', name: '06-settings' },
  { path: '/clawhub', name: '07-clawhub' },
];

const TITLE_BAR_FOCUS = [
  { path: '/dashboard', name: '08-titlebar-focus' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // 抓 console 错误
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      errors.push(`console: ${msg.text()}`);
    }
  });

  // 1. 主路由截图(hash 路由用 evaluate 改 location.hash 触发 vue-router)
  for (const r of ROUTES) {
    console.log(`📸 ${r.path}`);
    try {
      // 先用 goto 加载 app,后续路由只改 hash(因为 dev server 用 history 模式但 #/ 前缀)
      if (r.path === '/dashboard') {
        await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } else {
        await page.evaluate((p) => { window.location.hash = `#${p}`; }, r.path);
        await page.waitForTimeout(800);
      }
      await page.waitForSelector('.main-content', { timeout: 10000 });
      await page.waitForTimeout(1500);
      // 验证当前路径
      const actualPath = await page.evaluate(() => window.location.hash);
      console.log(`   url: ${actualPath}`);
      await page.screenshot({ path: join(OUT, `${r.name}.png`), fullPage: false });
      console.log(`   ✅ ${r.name}.png`);
    } catch (e) {
      console.log(`   ❌ ${e.message.split('\n')[0]}`);
    }
  }

  // 2. TitleBar 单独特写(dashboard,放大看窗口控件)
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const titleBar = await page.locator('.title-bar').first();
  if (await titleBar.count() > 0) {
    await titleBar.screenshot({ path: join(OUT, '08-titlebar-closeup.png') });
    console.log(`📸 08-titlebar-closeup.png (title bar 单独特写)`);
  }

  // 3. SideNav 展开状态
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const sideNav = await page.locator('.side-nav').first();
  if (await sideNav.count() > 0) {
    await sideNav.screenshot({ path: join(OUT, '09-sidenav-collapsed.png') });
    // hover 展开
    await sideNav.hover();
    await page.waitForTimeout(500);
    await sideNav.screenshot({ path: join(OUT, '10-sidenav-expanded.png') });
    console.log(`📸 09/10 sidenav collapsed/expanded`);
  }

  // 4. ChatSidebar 单独(看 more-icon 可见性)
  await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const chatSidebar = await page.locator('.sidebar, [class*="chat-sidebar"]').first();
  if (await chatSidebar.count() > 0) {
    await chatSidebar.screenshot({ path: join(OUT, '11-chatsidebar.png') });
    console.log(`📸 11-chatsidebar.png`);
  }

  // 5. 命令面板(按 Ctrl+K)
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, '12-command-palette.png') });
  console.log(`📸 12-command-palette.png`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  console.log(`\n=== 完成 ===`);
  console.log(`截图: ${OUT}/`);
  if (errors.length > 0) {
    console.log(`\n⚠️ 抓到 ${errors.length} 个错误:`);
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  } else {
    console.log(`✅ 无 console / page error`);
  }

  await browser.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
