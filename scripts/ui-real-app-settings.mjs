// 用 Playwright 起真实 Electron app (prod 模式, 读最新 dist/), 截图 Settings
import { _electron as electron } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js');
const OUT = 'ui-screenshots-v4.4-real-app';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TABS = [
  { key: 'basic', name: '01-basic', wait: 1500 },
  { key: 'models', name: '02-models', wait: 1000 },
  { key: 'mcp', name: '03-mcp', wait: 800 },
  { key: 'memory', name: '04-memory', wait: 600 },
  { key: 'about', name: '05-about', wait: 600 }
];

const THEMES = [
  { name: 'light', colorScheme: 'light' },
  { name: 'dark', colorScheme: 'dark' }
];

(async () => {
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
  });

  const window = await app.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('#app', { timeout: 15_000 });
  // 强制设大 viewport
  await window.setViewportSize({ width: 1440, height: 900 });
  await window.waitForTimeout(1500);

  // 验证 DOM 是不是新设计
  const initialCheck = await window.evaluate(() => {
    const nav = document.querySelector('.settings-nav');
    const navBtns = document.querySelectorAll('.settings-nav__btn').length;
    const settingRow = document.querySelector('.setting-row');
    const toggle = document.querySelector('.toggle');
    const radio = document.querySelector('.radio-group');
    const select = document.querySelector('.select-input');
    let ctrlInfo = null;
    if (toggle) {
      const r = toggle.getBoundingClientRect();
      const cs = getComputedStyle(toggle);
      ctrlInfo = { tag: 'toggle', x: r.x, y: r.y, w: r.width, h: r.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, bg: cs.backgroundColor };
    } else if (radio) {
      const r = radio.getBoundingClientRect();
      const cs = getComputedStyle(radio);
      ctrlInfo = { tag: 'radio-group', x: r.x, y: r.y, w: r.width, h: r.height, display: cs.display };
      const radios = document.querySelectorAll('.radio');
      ctrlInfo.radios = Array.from(radios).map(el => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { text: el.textContent, w: r.width, h: r.height, display: cs.display, bg: cs.backgroundColor, color: cs.color, border: cs.borderColor };
      });
    } else if (select) {
      const r = select.getBoundingClientRect();
      const cs = getComputedStyle(select);
      ctrlInfo = { tag: 'select-input', x: r.x, y: r.y, w: r.width, h: r.height, display: cs.display };
    }
    return { hasNav: !!nav, navBtnCount: navBtns, hasSettingRow: !!settingRow, hasToggle: !!toggle, hasRadio: !!radio, hasSelect: !!select, ctrlInfo };
  });
  console.log('=== Initial DOM check ===');
  console.log(JSON.stringify(initialCheck, null, 2));

  for (const theme of THEMES) {
    await window.emulateMedia({ colorScheme: theme.colorScheme });
    await window.evaluate((t) => {
      const root = document.documentElement;
      root.setAttribute('data-theme', t);
    }, theme.name);
    await window.waitForTimeout(500);

    // 跳到 Settings
    await window.evaluate(() => { window.location.hash = '#/settings'; });
    await window.waitForTimeout(2000);

    // 在 basic tab 下查控件 DOM 状态
    const inspect = await window.evaluate(() => {
      const toggle = document.querySelector('.toggle');
      const radio = document.querySelector('.radio');
      const select = document.querySelector('.select-input');
      const result = {};
      if (toggle) {
        const r = toggle.getBoundingClientRect();
        const cs = getComputedStyle(toggle);
        const after = getComputedStyle(toggle, '::after');
        const afterRect = toggle.querySelector(':scope') // dummy — we'll use pseudo via getBoundingClientRect workaround
        result.toggle = {
          w: r.width, h: r.height, x: r.x, y: r.y, display: cs.display,
          bg: cs.backgroundColor, br: cs.borderRadius, position: cs.position,
          afterContent: after.content, afterDisplay: after.display,
          afterPosition: after.position, afterWidth: after.width, afterHeight: after.height,
          afterLeft: after.left, afterTop: after.top, afterBg: after.backgroundColor, afterVisibility: after.visibility
        };
      }
      if (radio) {
        const r = radio.getBoundingClientRect();
        const cs = getComputedStyle(radio);
        result.radio = { w: r.width, h: r.height, x: r.x, y: r.y, display: cs.display, bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, text: radio.textContent };
      }
      if (select) {
        const r = select.getBoundingClientRect();
        const cs = getComputedStyle(select);
        result.select = { w: r.width, h: r.height, x: r.x, y: r.y, display: cs.display, bg: cs.backgroundColor, border: cs.borderColor };
      }
      return result;
    });
    console.log('=== After /settings jump DOM inspect ===');
    console.log(JSON.stringify(inspect, null, 2));

    for (const tab of TABS) {
      // 用 aria 定位 (更稳)
      const tabBtn = window.locator(`#settings-tab-${tab.key}`).first();
      const tabExists = await tabBtn.count() > 0;
      if (!tabExists) {
        console.log(`  ⚠ tab ${tab.key} not found`);
        continue;
      }
      await tabBtn.click();
      await window.waitForTimeout(tab.wait);
      const file = join(OUT, `${theme.name}-${tab.name}.png`);
      await window.screenshot({ path: file, fullPage: false });
      console.log(`✓ ${file}`);
    }
  }

  await app.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
