import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * PiPiClaw UI 烟雾测试 - 模拟用户交互
 *
 * 用 E2E_ELECTRON=1 启动 Electron 真实进程,
 * 模拟用户导航、点击、输入等操作,验证 UI 完整性。
 */

test.describe('UI interaction smoke test', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('capture console + screenshot for diagnosis', async ({ window }) => {
    // 收集所有 console 消息
    const logs: string[] = []
    window.on('console', (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`)
    })
    window.on('pageerror', (err) => {
      logs.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`)
    })

    // 给 Vue 一些时间挂载
    await window.waitForTimeout(3000)

    // 截图
    await window.screenshot({ path: 'test-results/ui-smoke-screenshot.png', fullPage: true })

    // 打印所有 console
    console.log('=== Console logs from renderer ===')
    for (const log of logs) console.log(log)
    console.log('=== End console logs ===')
  })

  test('navigate through main pages', async ({ window }) => {
    // 1. SideNav 应该有 14 个 nav-item(v4.2+ 列表)
    const navItems = window.locator('a.nav-item')
    await expect(navItems).toHaveCount(14, { timeout: 10_000 })

    // 2. 验证每个 nav-item 的文本(英文) — v4.2+ SideNav 列表
    const expectedNavTexts = [
      'Dashboard', 'AI Chat', 'Skills', 'ClawHub', 'Models',
      'Model Compare', 'IM Management', 'Automation Tasks', 'Schedule',
      'Permissions', 'Plugin Market', 'Remote Control', 'Settings', 'Help',
    ]
    for (const text of expectedNavTexts) {
      const item = window.locator(`a.nav-item:has-text("${text}")`)
      await expect(item).toBeVisible({ timeout: 5_000 })
    }

    // 截图 SideNav
    await window.screenshot({ path: 'test-results/ui-smoke-sidenav.png' })

    // 3. 点击"Models",验证跳转
    await window.click('a.nav-item:has-text("Models")')
    await window.waitForURL(/#\/models/, { timeout: 5_000 })
    await expect(window.locator('.models-page').first()).toBeVisible({ timeout: 5_000 })

    // 4. 点击"Settings"
    await window.click('a.nav-item:has-text("Settings")')
    await window.waitForURL(/#\/settings/, { timeout: 5_000 })
    await expect(window.locator('.settings-page, [class*="settings-view"]').first()).toBeVisible({ timeout: 5_000 })

    // 5. 回到 AI Chat
    await window.click('a.nav-item:has-text("AI Chat")')
    await window.waitForURL(/#\/chat/, { timeout: 5_000 })
  })

  test('chat flow: new conversation + type message', async ({ window }) => {
    // 通过 SideNav 导航到 /chat
    await window.click('a.nav-item:has-text("AI Chat")')
    await window.waitForURL(/#\/chat/, { timeout: 5_000 })

    // 找到"New Chat"按钮并点击
    const newChatBtn = window.locator('button:has-text("New Chat"), button:has-text("新建对话")').first()
    await newChatBtn.click()
    await window.waitForTimeout(500)

    // 找到输入框
    const textarea = window.locator('.input-row textarea, textarea[placeholder*="消息"], textarea[placeholder*="message"]').first()
    await expect(textarea).toBeVisible({ timeout: 5_000 })

    // 模拟用户输入
    await textarea.fill('Hello, this is a UI smoke test message')

    // 验证输入框内容
    await expect(textarea).toHaveValue('Hello, this is a UI smoke test message')

    // 截图存档
    await window.screenshot({ path: 'test-results/ui-smoke-chat.png', fullPage: true })
  })

  test('language switcher in SideNav works', async ({ window }) => {
    // 找到语言切换下拉框
    const langSwitcher = window.locator('.lang-switcher').first()
    await expect(langSwitcher).toBeVisible({ timeout: 5_000 })

    // 截图切换前
    await window.screenshot({ path: 'test-results/ui-smoke-lang-zh.png' })

    // 尝试切换到 English
    const selectEl = window.locator('.lang-switcher select').first()
    if (await selectEl.count() > 0) {
      await selectEl.selectOption('en-US')
    } else {
      // Element Plus 下拉:点击 -> 选 option
      await langSwitcher.click()
      await window.waitForTimeout(300)
      await window.locator('.el-select-dropdown__item:has-text("English")').first().click()
    }
    await window.waitForTimeout(500)

    // 截图切换后
    await window.screenshot({ path: 'test-results/ui-smoke-lang-en.png' })
  })
})
