/**
 * PiPiClaw - 路由冒烟测试 (B1-Bugfix regression guard)
 *
 * 历史 bug: Chat.vue 用动态模板字符串 import(`highlight.js/lib/languages/${lang}`),
 *   浏览器原生 dynamic import 无法解析,导致 Chat.vue 挂载失败,
 *   整个路由显示 fallback 内容 (实际是 Dashboard 内容残留)
 *
 * 这个测试用 playwright + dev server 验证核心路由渲染正确。
 *
 * 注意事项:
 *   - 需要 dev server 运行: npm run dev (端口 5173)
 *   - 需要 playwright: npx playwright install chromium
 *   - 跳过的路由(im-management, tasks, schedule, permissions):
 *     这些页面有预先存在的 row destructure 错误,与本次 UI 重塑无关
 *     留待后续单独修复
 *
 * 跑法: npm run dev (后台) && npm test -- tests/integration/routes-render.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'

const BASE_URL = 'http://localhost:5173'

interface RouteCase {
  path: string
  /** 期望在 main-content 中渲染的 class 名片段 */
  expectClass: string
}

/** 核心路由 — 这次 UI 重塑的关键验证 (B1 修复) */
const CORE_ROUTES: RouteCase[] = [
  { path: '/dashboard', expectClass: 'dashboard-page' },
  { path: '/chat', expectClass: 'chat-page' },
  { path: '/skills', expectClass: 'skills-page' },
  { path: '/models', expectClass: 'models-page' },
  { path: '/settings', expectClass: 'settings-page' },
  { path: '/help', expectClass: 'help-page' },
]

/** TODO: 这些路由有预先存在的 row destructure 错误,留待后续修复 */
const SKIP_ROUTES = ['/im-management', '/tasks', '/schedule', '/permissions']

describe('B1-Bugfix: 核心路由正确渲染 (no fallback to Dashboard)', () => {
  let browser: Browser | null = null
  let page: Page | null = null
  const errors: string[] = []

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
    })
  }, 30000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
  })

  for (const route of CORE_ROUTES) {
    it(`${route.path} 渲染正确的 page class (回归 B1)`, async () => {
      if (!page) throw new Error('Page not initialized')
      await page.goto(`${BASE_URL}/#${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })
      // 等 Vue 异步组件加载 + route 切换完成
      await page.waitForTimeout(1500)
      const mainHtml = await page.locator('main').innerHTML().catch(() => '')
      // 关键断言: 不是 fallback Dashboard 内容
      expect(
        mainHtml,
        `${route.path} 渲染了 fallback (可能是 Chat.vue 动态 import bug)`,
      ).toContain(route.expectClass)
    }, 20000)
  }

  it('关键: Chat.vue 不再因 dynamic template literal import 崩溃', async () => {
    if (!page) throw new Error('Page not initialized')
    await page.goto(`${BASE_URL}/#/chat`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForTimeout(1500)
    // 之前的 bug 是 "Failed to resolve module specifier 'highlight.js/lib/languages/javascript'"
    const chatErrors = errors.filter(
      (e) => e.includes('Failed to resolve module specifier') && e.includes('highlight.js'),
    )
    expect(
      chatErrors,
      'Chat.vue 不应再因 dynamic template literal import 报错',
    ).toEqual([])
  })
})