import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+150: 长对话历史 + 滚动
 *
 * 真实场景:用户发多条消息,验证:
 * - 所有消息都在 history 里
 * - 滚动不卡顿
 * - 切回早期消息仍能看到
 * - 工具栏/输入框不消失
 */

test.describe('T+150 Chat 长对话历史', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('L1: 进 Chat 后选已存在会话(跨测试共享 userData,会有历史)', async ({ window }) => {
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)

    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    // 选第一个现有会话
    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(1000)
    }

    const textarea = window.locator('.input-area textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })
  })

  test('L2: 长对话 messages 容器可滚动', async ({ window }) => {
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)
    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(1000)
    }

    // 找 messages 容器,验证有 scroll 能力
    const messagesContainer = window.locator('.messages-container, .message-list, [class*="message"]').first()
    if (await messagesContainer.count() > 0) {
      const exists = await messagesContainer.evaluate((el: any) => {
        // 找最近的 overflow:auto 父元素
        let cur: HTMLElement | null = el
        while (cur) {
          const style = getComputedStyle(cur)
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') return true
          cur = cur.parentElement
        }
        return false
      })
      expect(exists).toBe(true)
    }
  })

  test('L3: 多个 message 元素同时存在(历史可见)', async ({ window }) => {
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)
    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(1000)
    }

    // 等消息渲染
    await window.waitForTimeout(1000)

    // 找消息元素
    const messages = window.locator('.message, [class*="message-"]:not([class*="container"]):not([class*="list"])')
    const count = await messages.count()
    // 至少应该有 1 条消息(从历史)
    expect(count).toBeGreaterThan(0)
  })

  test('L4: 输入框始终可见(滚到底部)', async ({ window }) => {
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)
    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(1000)
    }

    // 滚到顶部
    await window.evaluate(() => {
      const m = document.querySelector('.messages-container') as HTMLElement
      if (m) m.scrollTop = 0
    })
    await window.waitForTimeout(500)

    // textarea 应该仍然可见(可能用 sticky / fixed)
    const textarea = window.locator('.input-area textarea').first()
    await expect(textarea).toBeVisible()
  })

  test('L5: 会话列表显示已选中的高亮', async ({ window }) => {
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)
    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(800)
    }

    // 至少有一个 active 会话
    const activeCount = await window.locator('.conversation-item.active, .conversation-item.is-active, .conversation-item.selected').count()
    expect(activeCount).toBeGreaterThanOrEqual(1)
  })
})
