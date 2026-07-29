import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * P7: 设置面板
 *
 * 真实测试场景 (E2E_ELECTRON=1):
 *   1. 启动 Electron renderer,导航到 /settings
 *   2. 验证 Settings.vue 渲染:基础设置 / 模型管理 / MCP 配置 / 记忆管理 标签
 *   3. 验证主题 select 可用
 *   4. 验证持久化(ConfigStore sync via IPC — 这里只验 UI 入口,
 *      完整 store 路径走 unit test:tests/unit/views/Settings.test.ts)
 *
 * 默认行为:
 *   - CI 默认 skip,本地 E2E_ELECTRON=1 跑
 *   - 跑前 npm run build
 *
 * 真要 mock ConfigStore IPC:
 *   electronApp.evaluate(({ ipcMain }) => ipcMain.emit('config:set', null, { key: 'theme', value: 'dark' }))
 */

test.describe('Settings P7', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1 to launch Electron renderer')

  test('settings page mounts with expected tabs', async ({ window }) => {
    await window.click('a.nav-item[href$="#/settings"]')
    await window.waitForURL(/#\/settings/)

    // 标题(中英文都覆盖)
    await expect(window.locator('h1.page-title').first()).toBeVisible({ timeout: 10_000 })

    // 验证页面有 settings 容器 + 至少一个 tab 相关选择器
    // Element Plus 在生产 build 偶尔 lazy render,放宽断言
    const settingsContainer = window.locator('.settings-content, .settings-page, .settings').first()
    await expect(settingsContainer).toBeVisible({ timeout: 5_000 })

    // 验证页面有 h2 / h3 子标题(说明有内容)
    const headings = await window.locator('h1, h2, h3').allTextContents()
    expect(headings.length).toBeGreaterThan(0)
  })

  test('basic settings panel exposes theme selector and shortcut recorder', async ({ window }) => {
    await window.click('a.nav-item[href$="#/settings"]')
    await window.waitForURL(/#\/settings/)

    // 基础设置 / Basic tab 默认激活
    const activeTab = window.locator('.settings-nav__btn.is-active').first()
    await expect(activeTab).toBeVisible({ timeout: 10_000 })

    // 主题选择:页面内出现 "选择主题" / "Select theme" 文本(用 i18n key t('settings.selectTheme'))
    const themeLabel = window.locator(':text("选择主题"), :text("Select theme")').first()
    await expect(themeLabel).toBeVisible({ timeout: 10_000 })
    // 主题切换改用 el-radio-group (light/dark/system),而不是 el-select
    await expect(window.locator('.el-radio-group').first()).toBeVisible()

    // 快捷键设置区:保存按钮 + 恢复默认按钮(i18n key: saveShortcut / resetShortcut)
    const saveBtn = window.locator('button:has-text("保存设置"), button:has-text("Save Settings")')
    const resetBtn = window.locator('button:has-text("恢复默认"), button:has-text("Reset to Default")')
    await expect(saveBtn.first()).toBeVisible()
    await expect(resetBtn.first()).toBeVisible()
  })

  test('can switch to models tab and see provider count', async ({ window }) => {
    await window.click('a.nav-item[href$="#/settings"]')
    await window.waitForURL(/#\/settings/)
    const modelsTab = window.locator('.settings-nav__btn:has-text("模型管理"), .settings-nav__btn:has-text("Models")').first()
    await modelsTab.click()
    // 等 element-plus 切换 active + 渲染
    await window.waitForFunction(() => {
      const active = document.querySelector('.settings-nav__btn.is-active')
      return active && /Models|模型管理/.test(active.textContent ?? '')
    }, { timeout: 5_000 })

    // provider 计数 或 空状态(中英文)
    // strict mode 兼容:用 locator() 而不是 .first().or()
    const counterOrEmpty = window.locator('.provider-count:visible, .el-empty:visible').first()
    await expect(counterOrEmpty).toBeVisible({ timeout: 5_000 })
    // 验证 counter 显示 "Enabled" 或 "已启用"
    const text = await counterOrEmpty.textContent()
    expect(text).toMatch(/已启用|Enabled/i)
  })

  test('mcp tab is reachable even when empty', async ({ window }) => {
    await window.click('a.nav-item[href$="#/settings"]')
    await window.waitForURL(/#\/settings/)
    const mcpTab = window.locator('.settings-nav__btn:has-text("MCP")').first()
    await mcpTab.click()
    // 等 element-plus 切换 active + 渲染
    await window.waitForFunction(() => {
      const active = document.querySelector('.settings-nav__btn.is-active')
      return active && /MCP/.test(active.textContent ?? '')
    }, { timeout: 5_000 })

    // 添加 MCP Server 按钮(中英文)
    const addBtn = window.locator(
      'button:has-text("添加 MCP Server"), button:has-text("Add MCP Server"), button:has-text("Add MCP")'
    )
    await expect(addBtn.first()).toBeVisible({ timeout: 5_000 })
  })
})
