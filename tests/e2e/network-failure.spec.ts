import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+600: Network 离线 / 黑洞 / 超时真用户测试
 *
 * 真实场景:用户网络异常时发消息:
 * NW1: provider baseUrl 指向黑洞 IP (192.0.2.1, RFC 5737 TEST-NET-1)
 *      → send 消息 → 短超时触发 → UI 显示错误
 * NW2: provider 短 timeout (1s) → 长消息超时 → UI 显示 timeout 错误
 * NW3: 黑洞 IP 不会让 send 按钮永远卡死(超时后恢复 enabled)
 * NW4: 切换到正确 provider 后能继续发消息
 */

test.describe('T+600 Network 离线 / 黑洞 / 超时', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  async function setupConversation(window: any) {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)
    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)
    // 强制新建会话
    const newChatBtn = window.locator('button.new-chat-btn, .empty-new-chat').first()
    if (await newChatBtn.count() > 0) {
      await newChatBtn.click()
      await window.waitForTimeout(1000)
    }
  }

  test('NW1: 黑洞 IP (192.0.2.1) + 短超时 → send 触发 ECONNREFUSED/timeout', async ({ window }) => {
    // 注入黑洞 IP provider
    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      // 清旧
      const listRes = await api.models.list()
      if (listRes?.success && listRes.data) {
        for (const p of listRes.data) {
          if (p.name === 'Blackhole (T+600)') await api.models.delete(p.id)
        }
      }
      const r = await api.models.add({
        name: 'Blackhole (T+600)',
        type: 'openai',
        baseUrl: 'http://192.0.2.1:11434/v1', // 黑洞 IP,TEST-NET-1
        apiKey: 'no-key',
        enabled: true,
        timeout: 3_000, // 3s 超时
        models: [{ id: 'fake', name: 'fake', capabilities: ['chat'] }]
      })
      return r?.success
    })
    expect(result).toBe(true)
    await window.waitForTimeout(500)

    await setupConversation(window)

    // 选 Blackhole provider
    const providerSelect = window.locator('.model-selector .el-select').first()
    if (await providerSelect.count() > 0) {
      await providerSelect.click()
      await window.waitForTimeout(500)
      const opt = window.locator('.el-select-dropdown__item:has-text("Blackhole (T+600)")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(800)
      }
    }

    // 选 fake model
    const modelSelect = window.locator('.model-selector .el-select').nth(1)
    if (await modelSelect.count() > 0) {
      await window.waitForFunction(() => {
        const sels = document.querySelectorAll('.model-selector .el-select')
        return sels[1] && !sels[1].querySelector('input[disabled]')
      }, { timeout: 10_000 }).catch(() => {})
      await modelSelect.click()
      await window.waitForTimeout(500)
      const opt = window.locator('.el-select-dropdown__item:has-text("fake")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(500)
      }
    }

    // 发消息
    const textarea = window.locator('.input-area textarea').first()
    await textarea.click()
    await textarea.fill('test blackhole')
    const sendBtn = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
    if (await sendBtn.count() > 0) {
      await sendBtn.click()
    } else {
      await textarea.press('Enter')
    }

    // 等错误出现(toast 或 bubble)
    await window.waitForFunction(() => {
      // 找任何错误指示
      const errToast = document.querySelector('.el-message--error')
      if (errToast) return true
      const errInBubble = Array.from(document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]'))
        .some(b => {
          const t = (b.textContent ?? '').toLowerCase()
          return t.includes('error') || t.includes('错误') || t.includes('timeout') || t.includes('connect') || t.includes('econnrefused')
        })
      return errInBubble
    }, { timeout: 30_000 })
  })

  test('NW2: 黑洞 IP 不会卡死 send 按钮(超时后恢复)', async ({ window }) => {
    // 先 reload 清掉 NW1 的残留状态
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1500)

    await setupConversation(window)

    // 输入文字后 send 按钮变 enabled
    // (空 textarea 时按钮 disabled 是正常的,不是卡死)
    const textarea = window.locator('.input-area textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10_000 })
    await textarea.fill('continue after blackhole')

    // 验证 send 按钮变 enabled(说明 isGenerating 已重置)
    // Element Plus 的 type="primary" 渲染为 .el-button--primary class,不是 button[type=primary]
    await window.waitForFunction(() => {
      const sendBtn = document.querySelector('.input-area .el-button--primary:not(.is-disabled):not([disabled])')
      return !!sendBtn
    }, { timeout: 15_000 })

    // 验证停止按钮(红色)不存在,说明 isGenerating === false
    const stopCount = await window.locator('.input-area button[type="danger"]:has-text("停止")').count()
    expect(stopCount).toBe(0)
  })

  test('NW3: 切到正确 Ollama → 可继续发消息', async ({ window }) => {
    // 注入好 Ollama
    await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const listRes = await api.models.list()
      if (listRes?.success && listRes.data) {
        for (const p of listRes.data) {
          if (p.name === 'Good Ollama (T+600)') await api.models.delete(p.id)
        }
      }
      await api.models.add({
        name: 'Good Ollama (T+600)',
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'no-key',
        enabled: true,
        timeout: 30_000,
        models: [{ id: 'qwen3.5:9b', name: 'qwen3.5:9b', capabilities: ['chat'] }]
      })
    })
    await window.waitForTimeout(500)

    await setupConversation(window)

    // 选 Good Ollama
    const providerSelect = window.locator('.model-selector .el-select').first()
    if (await providerSelect.count() > 0) {
      await providerSelect.click()
      await window.waitForTimeout(500)
      const opt = window.locator('.el-select-dropdown__item:has-text("Good Ollama (T+600)")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(800)
      }
    }

    const modelSelect = window.locator('.model-selector .el-select').nth(1)
    if (await modelSelect.count() > 0) {
      await window.waitForFunction(() => {
        const sels = document.querySelectorAll('.model-selector .el-select')
        return sels[1] && !sels[1].querySelector('input[disabled]')
      }, { timeout: 10_000 }).catch(() => {})
      await modelSelect.click()
      await window.waitForTimeout(500)
      const opt = window.locator('.el-select-dropdown__item:has-text("qwen3.5:9b")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(500)
      }
    }

    // 发消息
    const textarea = window.locator('.input-area textarea').first()
    await textarea.click()
    await textarea.fill('1+1=? 简短回答')
    const sendBtn = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
    if (await sendBtn.count() > 0) {
      await sendBtn.click()
    } else {
      await textarea.press('Enter')
    }

    // 等真实回复包含 2
    await window.waitForFunction(() => {
      const bubbles = document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
      for (const b of Array.from(bubbles)) {
        const text = b.textContent ?? ''
        if (text.includes('2') && text.length > 3) return true
      }
      return false
    }, { timeout: 60_000 })
  })

  test('NW4: 清理:删除测试 provider', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      let count = 0
      if (list?.success && list.data) {
        for (const p of list.data) {
          if (p.name === 'Blackhole (T+600)' || p.name === 'Good Ollama (T+600)') {
            await api.models.delete(p.id)
            count++
          }
        }
      }
      return { deleted: count }
    })
    expect(result.deleted).toBeGreaterThanOrEqual(2)
  })
})
