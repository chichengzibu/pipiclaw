#!/usr/bin/env node
/**
 * Chat 完整响应测试 - 等 LLM 完整生成
 */
import { _electron as electron } from 'playwright'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as wait } from 'node:timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(__dirname, '..')
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js')
const OUT = 'user-journey-ollama'
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

async function main() {
  console.log('\n=== Chat 完整响应测试 (qwen3.5:9b) ===\n')
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
  })
  const win = await app.firstWindow({ timeout: 30_000 })
  await win.waitForLoadState('domcontentloaded')
  await win.waitForSelector('#app', { timeout: 15_000 })
  await win.setViewportSize({ width: 1440, height: 900 })
  await wait(2000)

  // 清 stale + 设 Ollama
  await win.evaluate(() => {
    localStorage.setItem('lastProviderId', 'provider_ollama_default')
    localStorage.setItem('lastModelId', 'qwen3.5:9b')
  })
  await win.reload()
  await win.waitForSelector('#app', { timeout: 15_000 })
  await wait(2000)

  // 通过 electron store + models.json 改当前 conv provider (改 backend data)
  // 改 Pinia store: 让 store 暴露的属性生效
  await win.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    // 遍历所有 store 找 chat
    for (const [name, store] of pinia._s.entries()) {
      if (name === 'chat') {
        console.log('[debug] found chat store, keys:', Object.keys(store).join(','))
        window.__chatStore = store
        if (store.conversations) {
          for (const c of store.conversations) {
            c.providerId = 'provider_ollama_default'
            c.modelId = 'qwen3.5:9b'
          }
        }
        if (store.currentConversationId) {
          const cur = store.conversations?.find(c => c.id === store.currentConversationId)
          if (cur) {
            cur.providerId = 'provider_ollama_default'
            cur.modelId = 'qwen3.5:9b'
          }
        }
      }
    }
  })
  await wait(500)

  // 跳到 Chat
  await win.evaluate(() => { window.location.hash = '#/chat' })
  await wait(2000)
  await win.screenshot({ path: join(OUT, '10-chat-before.png') })

  // 点新建对话
  const newChatBtn = win.locator('button:has-text("新建对话")').first()
  if (await newChatBtn.count() > 0) {
    await newChatBtn.click()
    await wait(2000)
  }

  // 等 textarea
  let waited = 0
  while (waited < 8000 && (await win.locator('textarea').count() === 0)) {
    await wait(500); waited += 500
  }
  if (await win.locator('textarea').count() === 0) {
    console.log('❌ textarea 仍未出现')
    await app.close()
    return
  }

  // 输入
  await win.locator('textarea').first().fill('用一句话介绍 PiPiClaw 是什么')
  await wait(300)
  // 发送
  await win.locator('textarea').first().press('Enter')
  await wait(1500)
  await win.screenshot({ path: join(OUT, '11-chat-sent.png') })

  // 等生成完成
  console.log('⏳ 等 LLM 完整生成 (qwen3.5:9b 23s 典型, 给 180s 缓冲)...')
  const start = Date.now()
  let lastText = ''
  let stableCount = 0
  let finalText = ''
  let firstChunkAt = null
  let chunks = 0
  let done = false
  while (Date.now() - start < 180000 && !done) {
    const state = await win.evaluate(() => {
      // 找最后 assistant message
      const msgs = document.querySelectorAll('[class*="message"]')
      let lastA = null
      for (const m of msgs) {
        if (m.className && m.className.includes('assistant')) lastA = m
      }
      if (!lastA && msgs.length > 0) lastA = msgs[msgs.length - 1]
      const text = lastA ? (lastA.textContent || '').trim() : ''
      // "生成中" 已消失 = 完成
      const stillGen = document.body.textContent.includes('生成中') ||
                       document.body.textContent.includes('Generating') ||
                       !!document.querySelector('.typing-cursor, [class*="streaming"]')
      return { text, len: text.length, stillGen }
    })
    if (state.text.length > lastText.length) {
      if (!firstChunkAt) firstChunkAt = Date.now() - start
      lastText = state.text
      chunks++
      stableCount = 0
    } else {
      stableCount++
    }
    // 生成中消失 + 文本稳定 3s = 完成
    if (!state.stillGen && state.len > 50 && stableCount > 3) {
      done = true
      finalText = state.text
      console.log(`✓ 完整生成: ${state.len} 字符, ${chunks} chunks, ${Math.round((Date.now() - start) / 100) / 10}s`)
      break
    }
    if (firstChunkAt) {
      process.stdout.write(`\r  ... ${state.len} 字符 @ ${Math.round((Date.now() - start) / 100) / 10}s${state.stillGen ? ' (生成中)' : ''}   `)
    }
    await wait(700)
  }

  if (!done) {
    console.log(`\n⏱ 180s 超时, 当前文本: ${lastText.length} 字符`)
    finalText = lastText
  }

  await win.screenshot({ path: join(OUT, '12-chat-final.png') })

  // 写报告
  const report = `# Chat 完整响应报告\n\n` +
    `- 模型: qwen3.5:9b (本地 Ollama)\n` +
    `- 提示: "用一句话介绍 PiPiClaw 是什么"\n` +
    `- 首 chunk 延迟: ${firstChunkAt}ms\n` +
    `- 总耗时: ${Math.round((Date.now() - start) / 100) / 10}s\n` +
    `- 最终字符: ${finalText.length}\n` +
    `- chunk 增长: ${chunks}\n\n` +
    `## 完整响应\n\n\`\`\`\n${finalText}\n\`\`\`\n`
  writeFileSync(join(OUT, 'chat-final-report.md'), report)
  console.log(`\n\n📁 ${join(OUT, 'chat-final-report.md')}`)

  await app.close()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
