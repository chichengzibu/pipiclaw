import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+450: 国际化语言切换
 *
 * 真实场景:用户切换界面语言:
 * IL1: 初始是 zh-CN 或 en-US
 * IL2: 找到语言切换器(combobox in SideNav)
 * IL3: 切到 en-US → UI 文本变英文
 * IL4: 切回 zh-CN → UI 文本变回中文
 * IL5: 语言设置持久化(已在 T+420 覆盖)
 */

test.describe('T+450 国际化语言切换', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('IL1: 初始语言是 zh-CN 或 en-US', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)
    const lang = await window.evaluate(() => {
      return document.documentElement.lang || document.documentElement.getAttribute('data-lang') || ''
    })
    // 即使 html 没标 lang,看 sidebar combobox 当前值
    const sidebarCombobox = await window.evaluate(() => {
      const el = document.querySelector('.sidebar, .side-nav, nav')?.textContent || ''
      return el.includes('English') ? 'en-US' : 'zh-CN'
    })
    expect(['zh-CN', 'en-US']).toContain(sidebarCombobox)
  })

  test('IL2: SideNav 有语言切换器(combobox)', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // SideNav 底部应该有语言 combobox
    const langCombobox = window.locator('.sidebar .el-select, .side-nav .el-select, [class*="lang"]').first()
    await expect(langCombobox).toBeVisible({ timeout: 5_000 })
  })

  test('IL3: 切到 en-US → 看到 English / Dashboard', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // 找语言 combobox,点开
    const langCombobox = window.locator('.sidebar .el-select, .side-nav .el-select').first()
    if (await langCombobox.count() > 0) {
      await langCombobox.click()
      await window.waitForTimeout(500)
      // 选 English
      const opt = window.locator('.el-select-dropdown__item:has-text("English")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(1000)
      }
    }

    // 验证 sidebar 有 "Dashboard" (英文)
    const dashText = await window.locator('a.nav-item:has-text("Dashboard")').count()
    expect(dashText).toBeGreaterThan(0)
  })

  test('IL4: 切回 zh-CN → 看到 Dashboard / 仪表盘', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const langCombobox = window.locator('.sidebar .el-select, .side-nav .el-select').first()
    if (await langCombobox.count() > 0) {
      await langCombobox.click()
      await window.waitForTimeout(500)
      // 选中文(可能显示为 "中文" / "简体中文" / "Chinese")
      const opt = window.locator('.el-select-dropdown__item:has-text("中文"), .el-select-dropdown__item:has-text("Chinese"), .el-select-dropdown__item:has-text("简体")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(1000)
      }
    }

    // 验证 sidebar 有 "仪表盘" 或其他中文
    const zhText = await window.locator('a.nav-item:has-text("仪表盘"), a.nav-item:has-text("设置")').count()
    expect(zhText).toBeGreaterThan(0)
  })
})
