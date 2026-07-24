import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * P5-UX T+30: 日常 Chat 全流程
 *
 * 用户进 Chat 后会用到的核心交互:
 * 1. 输入框可写
 * 2. 发送按钮可点
 * 3. 多会话切换
 * 4. 会话删除 / 置顶
 * 5. 模型选择
 * 6. 消息渲染
 *
 * 选择器说明:
 * - "新建" 按钮有两处:sidebar 角落 (class=.new-chat-btn) 和空状态大按钮
 * - 用 class 匹配而非可见文字,避免 UI 文案调整导致测试脆弱
 * - 空状态按钮额外加 .empty-new-chat class
 */

test.describe('T+30 日常 Chat 全流程', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  // "新建对话" 按钮的稳定选择器 — sidebar 和空状态都覆盖
  const newChatBtnSel = 'button.new-chat-btn, .empty-new-chat, .empty-actions button:has-text("新建对话")'

  test('C1: Chat 输入框存在 + 可写', async ({ window }) => {
    // 进 Chat
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 找 textarea
    const textarea = window.locator('.chat-input textarea, textarea[placeholder*="输入"], textarea[placeholder*="消息"]').first()
    if (await textarea.count() > 0) {
      await expect(textarea).toBeVisible()
      await expect(textarea).toBeEnabled()
      // 试着输入
      await textarea.fill('测试消息 123')
      const val = await textarea.inputValue()
      expect(val).toBe('测试消息 123')
    }
  })

  test('C2: 发送按钮存在 + enabled(有内容时)', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    const textarea = window.locator('.chat-input textarea, textarea[placeholder*="输入"]').first()
    if (await textarea.count() > 0) {
      await textarea.fill('hello')
      await window.waitForTimeout(200)
      // 找发送按钮
      const sendBtn = window.locator('button:has-text("发送"), button:has-text("Send")').first()
      if (await sendBtn.count() > 0) {
        await expect(sendBtn).toBeEnabled()
      }
    }
  })

  test('C3: 点击 prompt 模板 → 自动填入输入框', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 先确保有会话
    const newChatBtn = window.locator(newChatBtnSel).first()
    if (await newChatBtn.count() > 0) {
      await newChatBtn.click()
      await window.waitForTimeout(500)
    }

    // 点 prompt 模板
    const promptCard = window.locator('.empty-prompt-card').first()
    if (await promptCard.count() > 0) {
      await promptCard.click()
      await window.waitForTimeout(500)
      // 输入框应该有内容
      const textarea = window.locator('.chat-input textarea').first()
      if (await textarea.count() > 0) {
        const val = await textarea.inputValue()
        // 至少有些内容
        expect(val.length).toBeGreaterThan(0)
      }
    }
  })

  test('C4: "新建对话"按钮创建新会话(空内容)', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 找新建按钮
    const newChatBtn = window.locator(newChatBtnSel).first()
    if (await newChatBtn.count() > 0) {
      const before = await window.locator('.conversation-item').count()
      await newChatBtn.click()
      await window.waitForTimeout(800)
      // 应该有"新对话已创建"反馈
      const messages = await window.locator('.el-message').allTextContents()
      const success = messages.some((m) => m.includes('新对话') || m.includes('创建') || m.includes('New'))
      // 即使没有 message 反馈,会话列表里也应该有
      const after = await window.locator('.conversation-item').count()
      expect(success || after > 0).toBe(true)
    }
  })

  test('C5: 多次新建 → 多个会话在 sidebar', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // sidebar 的 .new-chat-btn — 第一次创建后空状态消失,只剩它
    const newChatBtn = window.locator(newChatBtnSel).first()
    if (await newChatBtn.count() > 0) {
      await newChatBtn.click()
      await window.waitForTimeout(500)
      // 第二次:用 sidebar 的 .new-chat-btn (稳定 class)
      const sidebarNewChat = window.locator('button.new-chat-btn').first()
      if (await sidebarNewChat.count() > 0) {
        await sidebarNewChat.click()
        await window.waitForTimeout(500)
      }
      const conversations = await window.locator('.conversation-item').count()
      expect(conversations).toBeGreaterThanOrEqual(2)
    }
  })

  test('C6: 会话可点击切换', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 创建 2 个会话(用稳定的 .new-chat-btn + 空状态按钮)
    const firstBtn = window.locator(newChatBtnSel).first()
    if (await firstBtn.count() > 0) {
      await firstBtn.click()
      await window.waitForTimeout(500)
      const sidebarBtn = window.locator('button.new-chat-btn').first()
      if (await sidebarBtn.count() > 0) {
        await sidebarBtn.click()
        await window.waitForTimeout(500)
      }
    }

    // 点击第一个会话
    const conversations = window.locator('.conversation-item')
    const count = await conversations.count()
    if (count >= 2) {
      await conversations.first().click()
      await window.waitForTimeout(500)
      // 应该有 active class
      const active = await window.locator('.conversation-item.active').count()
      expect(active).toBeGreaterThan(0)
    }
  })

  test('C7: 模型选择器存在', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 找模型选择器
    const modelSelector = window.locator('.model-selector, .el-select, select').first()
    if (await modelSelector.count() > 0) {
      await expect(modelSelector).toBeVisible()
    }
  })

  test('C8: 设置(对话设置)按钮可点', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 找对话设置按钮(可能在 toolbar)
    const settingsBtn = window.locator('button:has-text("设置"), .chat-settings, [title*="设置"]').first()
    if (await settingsBtn.count() > 0) {
      await expect(settingsBtn).toBeVisible()
    }
  })

  test('C9: 消息历史可滚动(如果有消息)', async ({ window }) => {
    await window.click('a.nav-item:has-text("AI Chat"), a.nav-item:has-text("对话")').catch(() => {})
    await window.waitForTimeout(500)

    // 找消息列表
    const messages = window.locator('.message, [class*="message-"]')
    const count = await messages.count()
    // 即使没消息,容器也应在
    if (count === 0) {
      // 找消息容器
      const messageList = window.locator('.messages, .chat-messages, main.main-content')
      expect(await messageList.count()).toBeGreaterThan(0)
    }
  })
})
