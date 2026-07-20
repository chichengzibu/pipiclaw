// 诚实记录:由于 src/styles/tokens.css L9 注释嵌套导致 sass 编译失败,
// Vue 整体白屏 + Vite ErrorOverlay 显示。
// 截图保存到 retro 目录,作为真实环境的诚实记录。

import { chromium } from 'playwright';
import { mkdirSync, statSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT_DIR = process.argv[2] || 'docs/superpowers/retros/2026-07-16-a5demo-real-env';
mkdirSync(OUT_DIR, { recursive: true });

const DEMOS = [
  { name: 'd1', url: `${BASE}/#/d1-demo` },
  { name: 'd2', url: `${BASE}/#/d2-prime-demo` },
  { name: 'd3', url: `${BASE}/#/d3-demo` },
  { name: 'd5', url: `${BASE}/#/d5-demo` },
  { name: 'a5', url: `${BASE}/#/a5-demo` },
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const results = [];
  for (const d of DEMOS) {
    const page = await ctx.newPage();
    const consoleEvents = [];
    page.on('pageerror', (e) => consoleEvents.push(`PAGEERR: ${e.message.slice(0, 200)}`));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) consoleEvents.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
    });
    try {
      await page.goto(d.url, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(2500);
      const outPath = `${OUT_DIR}/${d.name}.png`;
      await page.screenshot({ path: outPath, fullPage: true });
      const stat = statSync(outPath);
      const docState = await page.evaluate(() => ({
        appHtml: (document.getElementById('app')?.innerHTML || '').length,
        bodyTextLen: (document.body.innerText || '').length,
        hasErrorOverlay: !!document.querySelector('vite-error-overlay'),
        title: document.title,
      }));
      results.push({
        name: d.name,
        ok: true,
        size: stat.size,
        consoleEvents: consoleEvents.slice(0, 8),
        docState,
      });
    } catch (e) {
      results.push({ name: d.name, ok: false, err: String(e?.message || e).slice(0, 200) });
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify({ results }, null, 2));
} finally {
  await browser.close();
}
