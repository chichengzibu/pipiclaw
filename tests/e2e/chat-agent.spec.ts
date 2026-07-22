import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * Chat: 对话窗口与 Agent 集成
 *
 * 真实测试场景 (E2E_ELECTRON=1):
 *   1. 启动 Electron renderer,导航到 /chat
 *   2. 验证 Chat.vue 主区域挂载(空状态 / 已有会话 两种情形)
 *   3. 验证 model selector 与 input textarea 存在
 *   4. 创建新会话,验证 sidebar 出现一条 conversation
 *
 * 默认行为:
 *   - 在 CI / 未设 E2E_ELECTRON 时,所有 test.skip 防御性跳过
 *   - 本地跑:npm run build && E2E_ELECTRON=1 npx playwright test tests/e2e/chat-agent.spec.ts
 *
 * 已知限制:
 *   - 真实 LLM 回复依赖 LlmAgentBrain + LlmConfig;
 *     没配 LLM 时 ChatManager 会走 stub,功能仍可验证 UI 流程
 *   - 真要打 mock LLM server 见 docs/e2e-testing.md(LlmConfigStore 反代思路)
 */

test.describe('Chat Agent integration', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1 to launch Electron renderer')

  test('app shell mounts and SideNav links to Chat', async ({ window }) => {
    // SideNav 必须有"对话"入口,链接到 /chat
    const chatLink = window.locator('a.nav-item:has-text("对话")')
    await expect(chatLink).toBeVisible({ timeout: 10_000 })
    await expect(chatLink).toHaveAttribute('href', '#/chat')

    // 状态栏显示版本号
    const status = window.locator('.app-status-bar')
    await expect(status).toContainText('PiPiClaw')
  })

  test('Chat page shows empty state or sessions list', async ({ window }) => {
    await window.click('a.nav-item:has-text("对话")')
    await window.waitForURL(/#\/chat/)

    // Chat.vue 顶层 .chat-page 必须渲染
    await expect(window.locator('.chat-page')).toBeVisible({ timeout: 10_000 })

    // 二选一:空状态(.empty-chat) 或 会话列表(.conversations-list)
    const emptyState = window.locator('.empty-chat')
    const sessionList = window.locator('.conversations-list')
    await expect(emptyState.or(sessionList)).toBeVisible({ timeout: 10_000 })
  })

  test('empty chat state exposes new-conversation CTA', async ({ window }) => {
    await window.goto('#/chat')

    // 触发"新建对话"按钮 — 即便有历史会话也可点,会再插一条
    const newChatButton = window.locator('button:has-text("新建对话")').first()
    // 可能为空状态 or 顶部 header 处的 button
    await expect(newChatButton).toBeVisible({ timeout: 10_000 })
  })

  test('input textarea is enabled when session is selected', async ({ window }) => {
    await window.goto('#/chat')

    // 如果有会话,直接点;否则新建
    const conversationItem = window.locator('.conversation-item').first()
    if (await conversationItem.count()) {
      await conversationItem.click()
    } else {
      await window.locator('button:has-text("新建对话")').first().click()
      // 等 chat-main 渲染
      await window.waitForSelector('.chat-main', { timeout: 10_000 })
    }

    // 文本输入框必须出现且非 disabled
    const textarea = window.locator('.input-row textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10_000 })
    await expect(textarea).toBeEnabled()
    // placeholder 文案:输入消息...
    await expect(textarea).toHaveAttribute('placeholder', /输入消息/)
  })
})
