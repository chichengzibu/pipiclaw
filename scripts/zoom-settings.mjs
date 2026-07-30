// 直接用 Playwright 浏览器(走 vite 5173) 截图, 截 Settings 区域放大
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
// 截整页 settings 区域 (左 nav + 右内容)
await page.screenshot({ path: 'ui-screenshots-v4.4-real-app/zoom-basic.png', clip: { x: 200, y: 90, width: 1200, height: 700 } });
console.log('saved zoom-basic.png');
await browser.close();
