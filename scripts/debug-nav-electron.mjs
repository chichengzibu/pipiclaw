// Debug: 复现 e2e 失败的 M2 场景
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js');

(async () => {
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1' }
  });
  const window = await app.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);

  // 进 Settings
  await window.click('a.nav-item[href$="#/settings"]');
  await window.waitForURL(/#\/settings/);
  await window.waitForTimeout(1500);

  // 找 nav btn
  const count = await window.locator('.settings-nav__btn').count();
  console.log(`nav__btn count: ${count}`);

  for (let i = 0; i < count; i++) {
    const text = await window.locator('.settings-nav__btn').nth(i).textContent();
    const cls = await window.locator('.settings-nav__btn').nth(i).getAttribute('class');
    const id = await window.locator('.settings-nav__btn').nth(i).getAttribute('id');
    console.log(`  [${i}] id=${id} class=${cls} text=${text}`);
  }

  // 试选择器
  const m2 = await window.locator('.settings-nav__btn:has-text("模型管理")').count();
  console.log(`\n:has-text("模型管理") count: ${m2}`);

  const m2e = await window.locator('.settings-nav__btn:has-text("Models")').count();
  console.log(`:has-text("Models") count: ${m2e}`);

  await app.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
