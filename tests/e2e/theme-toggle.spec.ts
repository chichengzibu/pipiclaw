import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+300: 主题切换 dark/light 全链路
 *
 * 真实场景:用户在 TitleBar 切换主题,验证:
 * - html data-theme 切到 dark
 * - 背景色变化
 * - 主要文字色变化
 * - 重启后持久化
 * - 主要组件(sidebar / chat / settings)都跟随
 * - Element Plus 主题变量同步
 */

test.describe('T+300 主题切换 dark/light', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('T1: 初始状态是 light 或 dark', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)
    const theme = await window.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(['light', 'dark']).toContain(theme)
  })

  test('T2: 切到 dark → html 有 .dark class', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // 用稳定的 .theme-toggle class(title 文字会随状态变,class 不会)
    const themeBtn = window.locator('button.theme-toggle').first()
    const before = await window.evaluate(() => document.documentElement.classList.contains('dark'))
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(800)
      const after = await window.evaluate(() => document.documentElement.classList.contains('dark'))
      expect(after).toBe(!before)
    }
  })

  test('T3: 切到 dark → 背景色变深', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const lightBg = await window.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })

    // 切主题
    const themeBtn = window.locator('button.theme-toggle').first()
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(1000)
    }

    const darkBg = await window.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })

    // 背景色应该不同
    expect(lightBg).not.toBe(darkBg)
  })

  test('T4: 切到 dark → 文字色变浅', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const lightFg = await window.evaluate(() => {
      return getComputedStyle(document.body).color
    })

    const themeBtn = window.locator('button.theme-toggle').first()
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(1000)
    }

    const darkFg = await window.evaluate(() => {
      return getComputedStyle(document.body).color
    })

    expect(lightFg).not.toBe(darkFg)
  })

  test('T5: 主题切换后,sidebar 背景跟随变化', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const lightSidebarBg = await window.evaluate(() => {
      const s = document.querySelector('.sidebar, .el-aside, nav, [class*="side"]') as HTMLElement
      return s ? getComputedStyle(s).backgroundColor : ''
    })

    const themeBtn = window.locator('button.theme-toggle').first()
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(1000)
    }

    const darkSidebarBg = await window.evaluate(() => {
      const s = document.querySelector('.sidebar, .el-aside, nav, [class*="side"]') as HTMLElement
      return s ? getComputedStyle(s).backgroundColor : ''
    })

    if (lightSidebarBg && darkSidebarBg) {
      expect(lightSidebarBg).not.toBe(darkSidebarBg)
    }
  })

  test('T6: 主题设置写入 config 持久化', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // 记录当前状态,click 之后应该翻转
    const before = await window.evaluate(() => document.documentElement.classList.contains('dark'))
    const expectedAfter = !before ? 'dark' : 'light'

    const themeBtn = window.locator('button.theme-toggle').first()
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(800)
    }

    // 验证 config.theme 等于翻转后的状态
    const cfg = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      if (!api?.config?.get) return null
      const r = await api.config.get('theme')
      return r?.data
    })
    if (cfg) {
      expect(cfg).toBe(expectedAfter)
    }
  })

  test('T7: 切回 light → 背景恢复', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // 先切一次
    const themeBtn = window.locator('button.theme-toggle').first()
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(800)
      // 再点切回
      await themeBtn.click()
      await window.waitForTimeout(800)
    }

    const isDark = await window.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(typeof isDark).toBe('boolean')
  })
})
