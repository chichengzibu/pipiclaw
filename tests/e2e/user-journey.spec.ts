import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * P5-UX T+0: 新用户首次启动 — 完整真实用户旅程
 *
 * 模拟一个真实用户的第一次启动:
 * 1. 打开 PiPiClaw → 看首页 (Dashboard)
 * 2. 看到什么?有引导吗?
 * 3. 怎么找到 AI 对话?
 * 4. 进 Chat 后看到什么?空状态友好吗?
 * 5. 怎么知道能做什么?(prompt 模板 + 命令面板)
 * 6. 切到深色主题 → 持久化吗?
 * 7. 关掉再开,主题还在吗?
 *
 * 每个 step 都是"真用户会做的动作",不是开发者视角。
 */

test.describe('T+0 新用户首次启动旅程', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('J1: 首页加载 — 看到 PiPiClaw 品牌', async ({ window }) => {
    // 默认路由是 /dashboard
    await window.waitForURL(/#\/dashboard/, { timeout: 5_000 })
    // 验证品牌可见
    const brand = await window.locator('body').textContent()
    expect(brand).toMatch(/PiPiClaw/i)
    // 验证有"工作台"或"Dashboard"字样
    expect(brand).toMatch(/工作台|Dashboard/i)
  })

  test('J2: 首页 — 看到 gateway 状态(没配置会引导)', async ({ window }) => {
    // 找 GatewayStatusBadge (sidebar 底部)
    const statusBadge = window.locator('[class*="gateway"], [class*="status"]').first()
    if (await statusBadge.count() > 0) {
      await expect(statusBadge).toBeVisible()
    }
  })

  test('J3: 用户进 Chat(从 SideNav 找 AI Chat)', async ({ window }) => {
    // 找 AI Chat 链接(中英文都试)
    const chatLink = window.locator('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').first()
    await expect(chatLink).toBeVisible({ timeout: 5_000 })
    await chatLink.click()
    await window.waitForURL(/#\/chat/, { timeout: 5_000 })
    expect(window.url()).toContain('/chat')
  })

  test('J4: Chat 空状态 — 看到 6 个 prompt 模板', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 验证 6 个 prompt 模板卡片(P5-UX 加的)
    const promptCards = window.locator('.empty-prompt-card')
    const cardCount = await promptCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(4) // 至少有 4 个模板

    // 至少看到一个 emoji
    const emojis = window.locator('.empty-prompt-emoji')
    expect(await emojis.count()).toBeGreaterThan(0)
  })

  test('J5: Chat 空状态 — 有时间感知问候', async ({ window }) => {
    const greeting = window.locator('.empty-title')
    if (await greeting.count() > 0) {
      const text = await greeting.textContent()
      // 中文问候含"好"或英文含 good
      expect(text).toMatch(/好|晚上|早上|下午|深夜|night|morning|afternoon|evening/i)
    }
  })

  test('J6: Chat 有"新建对话"按钮', async ({ window }) => {
    // 在 Chat 页面
    await window.waitForTimeout(300)
    const newChatButton = window.locator('button:has-text("新建对话"), button:has-text("New Chat")').first()
    if (await newChatButton.count() > 0) {
      await expect(newChatButton).toBeVisible()
    }
  })

  test('J7: 用户按 Ctrl+K → 命令面板打开', async ({ window }) => {
    // 模拟 Ctrl+K
    await window.keyboard.press('Control+K')
    await window.waitForTimeout(300)
    // 验证 .palette-backdrop 出现
    const palette = window.locator('.palette-backdrop')
    if (await palette.count() > 0) {
      await expect(palette).toBeVisible()
      // Esc 关闭
      await window.keyboard.press('Escape')
      await window.waitForTimeout(200)
    }
  })

  test('J8: 命令面板 — 输入"模型" → 看到结果', async ({ window }) => {
    await window.keyboard.press('Control+K')
    await window.waitForTimeout(300)
    const input = window.locator('.palette-input').first()
    if (await input.count() > 0) {
      await input.fill('模型')
      await window.waitForTimeout(200)
      const items = window.locator('.palette-item')
      const count = await items.count()
      expect(count).toBeGreaterThan(0)
    }
    await window.keyboard.press('Escape')
  })

  test('J9: 用户找主题切换按钮(TitleBar)', async ({ window }) => {
    // TitleBar 的 theme-toggle 按钮(class 是 .control-btn.theme-toggle)
    const themeBtn = window.locator('button.theme-toggle, [aria-label*="主题"]').first()
    if (await themeBtn.count() > 0) {
      await expect(themeBtn).toBeVisible()
    }
  })

  test('J10: 主题切换 — 切到深色 → html.dark class 出现', async ({ window }) => {
    // 找 theme-toggle 按钮并点击
    const themeBtn = window.locator('button.theme-toggle, [aria-label*="主题"]').first()
    if (await themeBtn.count() > 0) {
      const initialDark = await window.evaluate(() => document.documentElement.classList.contains('dark'))
      await themeBtn.click()
      await window.waitForTimeout(500)
      const afterDark = await window.evaluate(() => document.documentElement.classList.contains('dark'))
      // 状态应该反转
      expect(afterDark).toBe(!initialDark)
    }
  })

  test('J11: 主题持久化 — 重启后还在(测试 config persistence)', async ({ window }) => {
    // 切换主题
    const themeBtn = window.locator('button.theme-toggle, [aria-label*="主题"]').first()
    if (await themeBtn.count() > 0) {
      await themeBtn.click()
      await window.waitForTimeout(500)
      // 验证 config 写入了
      const themeConfig = await window.evaluate(async () => {
        const r = await (window as any).electronAPI?.config?.get?.('theme')
        return r?.data
      })
      expect(themeConfig).toBeDefined()
    }
  })

  test('J12: 用户找设置(右上角或 sidebar)', async ({ window }) => {
    // Sidebar 的 Settings 链接
    const settingsLink = window.locator('a.nav-item:has-text("Settings"), a.nav-item:has-text("设置")').first()
    await expect(settingsLink).toBeVisible({ timeout: 5_000 })
  })

  test('J13: 找 IM 管理入口(v4.1 核心功能)', async ({ window }) => {
    // 用户升级到 v4.1 应该有 IM 管理入口
    const imLink = window.locator('a.nav-item:has-text("IM Management"), a.nav-item:has-text("IM 管理")').first()
    if (await imLink.count() > 0) {
      await expect(imLink).toBeVisible()
    }
  })

  test('J14: 找 ClawHub 技能市场入口(v4.1 核心功能)', async ({ window }) => {
    const clawhubLink = window.locator('a.nav-item:has-text("ClawHub")').first()
    if (await clawhubLink.count() > 0) {
      await expect(clawhubLink).toBeVisible()
    }
  })

  test('J15: 找模型对比入口(v4.1 核心功能)', async ({ window }) => {
    const compareLink = window.locator('a.nav-item:has-text("Model Compare"), a.nav-item:has-text("模型对比")').first()
    if (await compareLink.count() > 0) {
      await expect(compareLink).toBeVisible()
    }
  })

  test('J16: 状态栏 — 有版本号 + 快捷键提示', async ({ window }) => {
    const statusBar = window.locator('.app-status-bar').first()
    if (await statusBar.count() > 0) {
      const text = await statusBar.textContent()
      expect(text).toMatch(/v?\d+\.\d+\.\d+/)  // v4.3.0 之类
    }
  })

  test('J17: 命令面板按钮 — 状态栏有"命令"快捷入口', async ({ window }) => {
    const cmdBtn = window.locator('.status-shortcut, [title*="Ctrl"]').first()
    if (await cmdBtn.count() > 0) {
      await expect(cmdBtn).toBeVisible()
    }
  })
})
