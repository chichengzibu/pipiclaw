/**
 * 真 app (electron prod build) 截图 — 5 页 × 2 theme, 验证 emoji → SVG icon 改造
 */
import { _electron as electron } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js');
const OUT = 'ui-screenshots-v4.4-icons';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: '01-dashboard', hash: '#/dashboard', wait: 1200 },
  { name: '02-chat',      hash: '#/chat',      wait: 1200 },
  { name: '03-models',    hash: '#/models',    wait: 1200 },
  { name: '04-skills',    hash: '#/skills',    wait: 1200 },
  { name: '05-settings',  hash: '#/settings',  wait: 1200 }
];

const THEMES = [
  { name: 'light', colorScheme: 'light' },
  { name: 'dark',  colorScheme: 'dark' }
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
  await window.setViewportSize({ width: 1440, height: 900 });
  await window.waitForTimeout(1500);

  for (const theme of THEMES) {
    await window.emulateMedia({ colorScheme: theme.colorScheme });
    await window.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
    }, theme.name);
    await window.waitForTimeout(400);

    for (const p of PAGES) {
      await window.evaluate((h) => { window.location.hash = h; }, p.hash);
      await window.waitForTimeout(p.wait);
      const file = join(OUT, `${theme.name}-${p.name}.png`);
      await window.screenshot({ path: file, fullPage: false });
      console.log(`✓ ${file}`);
    }
  }

  await app.close();
  console.log('\n✅ done → ' + OUT);
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
