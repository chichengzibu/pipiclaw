import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+90: 真链路 send/receive 全链路验证
 *
 * 真实场景:用户配好 Ollama → 进 Chat → 发消息 → 收到真实模型回复
 *
 * 测试步骤:
 * R1: 通过 IPC 注入 Ollama provider + qwen3.5:9b 模型
 * R2: 启用 provider + 设为默认
 * R3: 进 Chat → 选模型 → 发"1+1=?"消息
 * R4: 等待 assistant message bubble 出现 + 包含数字 "2"
 * R5: 流式增量更新(发第二条消息,验证能继续发)
 *
 * 失败语义:
 * - R1 失败:IPC 序列化 / ConfigStore bug
 * - R2 失败:default model 设置 / 持久化 bug
 * - R3 失败:模型选择器 bug / UI 路由 bug
 * - R4 失败(超时):streaming bug / 模型太慢 / LlmClient bug
 * - R4 失败(空内容):thinking mode 没 fallback / content 解析 bug
 * - R5 失败:状态恢复 bug(发完一条后无法继续)
 */

test.describe('T+90 Chat 真链路 send/receive', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')
  // Ollama 必须在 localhost:11434 跑(用 qwen3.5:9b — 速度冠军)
  test.skip(!process.env.OLLAMA_URL, 'set OLLAMA_URL=http://localhost:11434 to run')

  test('R1: 通过 IPC 注入 Ollama provider (清旧 + 注入新)', async ({ electronApp, window }) => {
    // 调用 preload 暴露的 IPC API(在 renderer 进程)
    // 1) 清理同名旧 provider,避免测试运行间重复
    // 2) 注入新 provider
    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI || (window as any).pipiclaw
      if (!api?.models?.add) return { ok: false, error: 'no models.add API', full: null }

      // 清旧:列出所有 provider,删掉 "Ollama Local (T+90)" 同名
      const listRes = await api.models.list()
      if (listRes?.success && listRes.data) {
        for (const p of listRes.data) {
          if (p.name === 'Ollama Local (T+90)') {
            await api.models.delete(p.id)
          }
        }
      }

      const r = await api.models.add({
        name: 'Ollama Local (T+90)',
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'no-key',
        enabled: true,
        timeout: 60_000,
        models: [
          { id: 'qwen3.5:9b', name: 'qwen3.5:9b', capabilities: ['chat'] }
        ]
      })
      return { ok: r?.success, error: r?.error, full: JSON.stringify(r) }
    })
    if (!result.ok) {
      console.log('R1 IPC failed:', result.error, '|', result.full)
    }
    expect(result.ok).toBe(true)
    expect(result.error).toBeFalsy()
  })

  test('R2: 进 Chat → 选模型 → 发消息 → 收到回复', async ({ window }) => {
    // 重新加载页(确保 R1 注入的 provider 可见)
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)

    // 诊断:看主进程有多少 provider
    const providerList = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      if (!api?.models?.list) return { count: 0, providers: [], err: 'no list API' }
      const r = await api.models.list()
      return {
        count: r?.data?.length || 0,
        providers: (r?.data || []).map((p: any) => ({ id: p.id, name: p.name, enabled: p.enabled, models: p.models?.length || 0 })),
        err: r?.error
      }
    })
    console.log('R2 provider list:', JSON.stringify(providerList))

    // 进 Chat
    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    // 优先点 sidebar 已有的会话(用 .conversation-item 第一个,而不是 new-chat)
    // 跨测试共享 userData,sidebar 会有历史会话
    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(1000)
    }

    // 等右面板的 textarea 出现(.input-area 是 v-if=currentConversation)
    const textarea = window.locator('.input-area textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    // 选 provider — 第一个 el-select 是 provider
    const providerSelect = window.locator('.model-selector .el-select').first()
    if (await providerSelect.count() > 0) {
      await providerSelect.click()
      await window.waitForTimeout(500)
      const providerOpt = window.locator('.el-select-dropdown__item:has-text("Ollama Local (T+90)")').first()
      if (await providerOpt.count() > 0) {
        await providerOpt.click()
        await window.waitForTimeout(800)
      }
    }

    // 选 model — 第二个 el-select 是 model
    const modelSelect = window.locator('.model-selector .el-select').nth(1)
    if (await modelSelect.count() > 0) {
      // 等 model select 从 disabled 变 enabled(provider 选完后才能选)
      await window.waitForFunction(() => {
        const sels = document.querySelectorAll('.model-selector .el-select')
        const modelSel = sels[1] as HTMLElement
        return modelSel && !modelSel.querySelector('input[disabled]')
      }, { timeout: 10_000 }).catch(() => {})

      await modelSelect.click()
      await window.waitForTimeout(500)
      const opt = window.locator('.el-select-dropdown__item:has-text("qwen3.5:9b")').first()
      if (await opt.count() > 0) {
        await opt.click()
        await window.waitForTimeout(500)
      }
    }

    // 输入消息
    await textarea.click()
    await textarea.fill('1+1=? 只需回答数字')
    await window.waitForTimeout(200)

    // 点 send(或按 Enter)
    const sendBtn = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
    if (await sendBtn.count() > 0) {
      await sendBtn.click()
    } else {
      await textarea.press('Enter')
    }

    // 等待 assistant message bubble 出现 + 内容包含 "2"
    // qwen3.5:9b 一般 5-15s 出第一个 token
    const assistantBubble = window.locator('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
    await expect(assistantBubble.first()).toBeVisible({ timeout: 30_000 })

    // 等待内容包含 "2"(最多 60s)
    await window.waitForFunction(() => {
      const bubbles = document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
      for (const b of Array.from(bubbles)) {
        const text = b.textContent ?? ''
        if (text.includes('2') && text.length > 3) return true
      }
      return false
    }, { timeout: 60_000 })

    // 验证消息状态不是 "error"
    const errMsg = await window.locator('.el-message--error').count()
    expect(errMsg).toBe(0)
  })

  test('R3: 发送第二条消息 → 仍能继续对话', async ({ window }) => {
    // 重新加载(从 R1 注入的 provider 起步)
    await window.reload()
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(1200)

    await window.click('a.nav-item[href$="#/chat"]').catch(() => {})
    await window.waitForTimeout(1500)

    // 点现有会话
    const existingConv = window.locator('.conversation-item').first()
    if (await existingConv.count() > 0) {
      await existingConv.click()
      await window.waitForTimeout(1000)
    }

    const textarea = window.locator('.input-area textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    // 第一条消息
    await textarea.click()
    await textarea.fill('你好,你是谁?')
    await window.waitForTimeout(200)
    const sendBtn = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
    if (await sendBtn.count() > 0) {
      await sendBtn.click()
    } else {
      await textarea.press('Enter')
    }

    // 等待第一个回复
    await window.waitForFunction(() => {
      const bubbles = document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
      for (const b of Array.from(bubbles)) {
        const text = b.textContent ?? ''
        if (text.length > 5) return true
      }
      return false
    }, { timeout: 60_000 })

    // 等发送状态恢复
    await window.waitForFunction(() => {
      const loading = document.querySelector('.input-area button[disabled]')
      return !loading
    }, { timeout: 60_000 })

    // 第二条消息
    const textarea2 = window.locator('.input-area textarea').first()
    await textarea2.click()
    await textarea2.fill('2+2=?')
    await window.waitForTimeout(200)
    const sendBtn2 = window.locator('.input-area button:has-text("发送"), .input-area button:has-text("Send")').first()
    if (await sendBtn2.count() > 0) {
      await sendBtn2.click()
    } else {
      await textarea2.press('Enter')
    }

    // 验证至少有 2 条 assistant 消息
    await window.waitForFunction(() => {
      const bubbles = document.querySelectorAll('.message.assistant, .assistant-message, [class*="message"][class*="assistant"]')
      return bubbles.length >= 2
    }, { timeout: 60_000 })
  })
})
