// 真实 app 当前页 vs v4-mockup 同页对比
// 1. 起真 Electron app (prod 模式, 读最新 dist/) 截 5 页
// 2. 截 v4-mockup.html 5 页
// 3. 拼图 side-by-side
import { _electron as electron } from 'playwright';
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js');
const MOCKUP = 'C:\\Users\\Administrator\\.minimax\\v2\\assets\\2026\\07\\30\\08-22-16-602-asset_20260730-082216-602_f92ba241a589_fb8632e1-v4-mockup.html';
const OUT = 'ui-screenshots-compare';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const PAGES = [
  { hash: '#/dashboard', mockupPage: 'dashboard', name: '01-dashboard' },
  { hash: '#/chat', mockupPage: 'chat', name: '02-chat' },
  { hash: '#/models', mockupPage: 'models', name: '03-models' },
  { hash: '#/skills', mockupPage: 'skills', name: '04-skills' },
  { hash: '#/settings', mockupPage: 'settings', name: '05-settings' }
];

const realShots = [];
const mockShots = [];

(async () => {
  // === 1. 真实 app 5 页 ===
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1' }
  });
  const window = await app.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('#app', { timeout: 15_000 });
  await window.setViewportSize({ width: 1280, height: 800 });
  await window.waitForTimeout(2000);

  for (const p of PAGES) {
    await window.evaluate((h) => { window.location.hash = h; }, p.hash);
    await window.waitForTimeout(1500);
    const file = join(OUT, `real-${p.name}.png`);
    await window.screenshot({ path: file, fullPage: false });
    realShots.push({ name: p.name, file });
    console.log(`✓ real ${p.name}`);
  }
  await app.close();

  // === 2. mockup 5 页 ===
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file:///' + MOCKUP.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  for (const p of PAGES) {
    // 隐藏 mockup-bar + 切到目标 page (用 button click, showPage 是 const 不在 window 上)
    await page.evaluate((page) => {
      const bar = document.querySelector('.mockup-bar');
      if (bar) bar.style.display = 'none';
      // 直接操作 DOM 模拟 showPage
      document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.dataset.page === page));
      document.querySelectorAll('[data-page]').forEach(b => {
        if (b.tagName === 'BUTTON') b.classList.toggle('active', b.dataset.page === page);
      });
      document.querySelectorAll('[data-page-link]').forEach(b => {
        b.classList.toggle('active', b.dataset.pageLink === page);
      });
      const crumbsMap = { dashboard: '首页', chat: '对话', models: '模型', skills: '技能市场', settings: '设置' };
      const c = document.getElementById('crumbs');
      if (c) c.textContent = crumbsMap[page] || '';
    }, p.mockupPage);
    await page.waitForTimeout(400);
    const file = join(OUT, `mock-${p.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    mockShots.push({ name: p.name, file });
    console.log(`✓ mock ${p.name}`);
  }
  await browser.close();

  // === 3. 拼图 side-by-side ===
  // 用 Sharp 不行, 直接写 HTML 比对页
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Real App vs Mockup 对比</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #1a1a1a; color: #fff; padding: 20px; margin: 0; }
  h1 { text-align: center; font-size: 18px; margin: 0 0 24px; }
  .pair { margin-bottom: 32px; }
  .pair h2 { font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #9ca3af; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #2a2a2a; padding: 8px; border-radius: 8px; }
  .row > div { position: relative; }
  .row .label { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; font-size: 11px; padding: 2px 8px; border-radius: 4px; z-index: 1; }
  .row img { width: 100%; display: block; border-radius: 4px; }
</style></head>
<body>
<h1>PiPiClaw 真实 app vs v4-mockup 设计效果对比</h1>
${realShots.map((r, i) => `
<div class="pair">
<h2>${r.name.replace(/^\d+-/, '').toUpperCase()}</h2>
<div class="row">
  <div><span class="label">真实 app (prod build)</span><img src="${r.file.replace(/.*\//, '')}"></div>
  <div><span class="label">Mockup (设计目标)</span><img src="${mockShots[i].file.replace(/.*\//, '')}"></div>
</div>
</div>
`).join('')}
</body></html>`;
  writeFileSync(join(OUT, 'index.html'), html);
  console.log(`✓ 对比页: ${join(OUT, 'index.html')}`);
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
