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
    await window.goto('#/settings')

    // 标题
    await expect(window.locator('h1.page-title:has-text("系统设置")')).toBeVisible({
      timeout: 10_000,
    })

    // 4 个 tab 标签 — Element Plus el-tab-pane 渲染为 .el-tabs__item
    const tabLabels = ['基础设置', '模型管理', 'MCP 配置', '记忆管理']
    for (const label of tabLabels) {
      const tab = window.locator(`.el-tabs__item:has-text("${label}")`)
      await expect(tab).toBeVisible({ timeout: 10_000 })
    }
  })

  test('basic settings panel exposes theme selector and shortcut recorder', async ({ window }) => {
    await window.goto('#/settings')
    // 基础设置 tab 默认激活,无需切换
    await expect(window.locator('.el-tabs__item.is-active:has-text("基础设置")')).toBeVisible({
      timeout: 10_000,
    })

    // 主题选择:placeholder="请选择主题"
    const themeSelect = window.locator('.el-select:has(input[placeholder="请选择主题"])')
    await expect(themeSelect).toBeVisible({ timeout: 10_000 })

    // 快捷键设置区:保存按钮 + 恢复默认按钮
    await expect(window.locator('button:has-text("保存设置")')).toBeVisible()
    await expect(window.locator('button:has-text("恢复默认")')).toBeVisible()
  })

  test('can switch to models tab and see provider count', async ({ window }) => {
    await window.goto('#/settings')
    const modelsTab = window.locator('.el-tabs__item:has-text("模型管理")')
    await modelsTab.click()

    // tab 内容 #tab-models 必须可见
    await expect(window.locator('#pane-models')).toBeVisible({ timeout: 10_000 })

    // provider 计数 (形如 "0/0 已启用" 或 "1/3 已启用"),带 已启用
    const counter = window.locator('.provider-count')
    if (await counter.count()) {
      await expect(counter).toContainText('已启用')
    } else {
      // 没有 provider 时显示 el-empty
      await expect(window.locator('.el-empty')).toBeVisible()
    }
  })

  test('mcp tab is reachable even when empty', async ({ window }) => {
    await window.goto('#/settings')
    await window.locator('.el-tabs__item:has-text("MCP 配置")').click()

    await expect(window.locator('#pane-mcp')).toBeVisible({ timeout: 10_000 })

    // 添加 MCP Server 按钮
    await expect(window.locator('button:has-text("添加 MCP Server")').first()).toBeVisible()
  })
})
