#!/usr/bin/env node
/**
 * PiPiClaw - Chat 真实 LLM 流式测试 (qwen3.5:9b)
 *
 * 步骤:
 *   1. 起 electron app
 *   2. 进 /chat
 *   3. 点 "新建对话" 创建新对话
 *   4. 选 provider (Ollama) + model (qwen3.5:9b)
 *   5. 输入消息 "用一句话介绍 PiPiClaw 是什么"
 *   6. 发送 → 等待 LLM 流式响应
 *   7. 截图 + 报告
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
  console.log('\n=== Chat LLM 流式响应测试 (qwen3.5:9b) ===\n')

  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
  })

  const win = await app.firstWindow({ timeout: 30_000 })
  await win.waitForLoadState('domcontentloaded')
  await win.waitForSelector('#app', { timeout: 15_000 })
  await win.setViewportSize({ width: 1440, height: 900 })
  await win.waitForTimeout(1500)

  // 跳到 Chat
  await win.evaluate(() => { window.location.hash = '#/chat' })
  await win.waitForTimeout(1500)
  await win.screenshot({ path: join(OUT, '10-chat-before-new.png') })

  // 点 "新建对话" 按钮
  console.log('1. 点新建对话...')
  const newChatBtn = win.locator('button:has-text("新建对话")').first()
  const newChatExists = await newChatBtn.count() > 0
  if (!newChatExists) {
    console.log('  ! 没找到 "新建对话" 按钮, 尝试 SideNav 顶部 +新建')
    const altBtn = win.locator('header button:has-text("新建")').first()
    if (await altBtn.count() > 0) {
      await altBtn.click()
    } else {
      throw new Error('没找到任何新建对话入口')
    }
  } else {
    await newChatBtn.click()
  }
  await win.waitForTimeout(1500)
  await win.screenshot({ path: join(OUT, '11-chat-after-new.png') })

  // 找 textarea
  const textarea = win.locator('textarea').first()
  const textareaExists = await textarea.count() > 0
  if (!textareaExists) {
    console.log('  ! 还没出现 textarea, 等一下...')
    await win.waitForTimeout(2000)
  }
  const textarea2 = win.locator('textarea').first()
  if (await textarea2.count() === 0) {
    throw new Error('新建对话后仍没找到 textarea')
  }

  // 输入消息
  console.log('2. 输入消息 "用一句话介绍 PiPiClaw 是什么"...')
  await textarea2.fill('用一句话介绍 PiPiClaw 是什么')
  await win.waitForTimeout(500)
  await win.screenshot({ path: join(OUT, '12-chat-typed.png') })

  // 发送 (Enter)
  console.log('3. 按 Enter 发送...')
  await textarea2.press('Enter')
  await win.waitForTimeout(1000)
  await win.screenshot({ path: join(OUT, '13-chat-sent.png') })

  // 等 LLM 响应
  console.log('4. 等待 LLM 流式响应 (qwen3.5:9b)...')
  const startWait = Date.now()
  let firstChunkAt = null
  let lastChunkAt = null
  let lastTextLen = 0
  const result = {
    firstChunkAt: null,
    lastChunkAt: null,
    totalChunks: 0,
    finalResponse: null,
    finalLen: 0
  }

  while (Date.now() - startWait < 90000) {
    const state = await win.evaluate(() => {
      // 找 message 列表里的最后一条 assistant 消息
      const messages = document.querySelectorAll('.message, [data-role="assistant"]')
      let lastAssistant = null
      for (const m of messages) {
        const role = m.className || ''
        const dataRole = m.getAttribute('data-role') || ''
        if (role.includes('assistant') || dataRole === 'assistant') {
          lastAssistant = m
        }
      }
      if (!lastAssistant) {
        // fallback: 最后一个 message 元素
        const all = document.querySelectorAll('.message')
        if (all.length > 0) lastAssistant = all[all.length - 1]
      }
      if (!lastAssistant) return { found: false }
      const text = (lastAssistant.textContent || '').trim()
      return { found: true, text, len: text.length }
    })

    if (state.found && state.len > 0) {
      if (!firstChunkAt) {
        firstChunkAt = Date.now() - startWait
        result.firstChunkAt = firstChunkAt
        console.log(`  ✓ 首 chunk 出现: ${firstChunkAt}ms (${state.len} 字符)`)
      }
      if (state.len > lastTextLen) {
        result.totalChunks++
        lastTextLen = state.len
        lastChunkAt = Date.now() - startWait
        // 每 5s 报一次
        if (result.totalChunks % 5 === 0) {
          console.log(`  ... ${state.len} 字符 @ ${lastChunkAt}ms`)
        }
      }
    }

    // 检测完成 (10s 内无增长 = 结束)
    if (firstChunkAt && lastChunkAt && (Date.now() - lastChunkAt) > 5000 && state.found) {
      result.lastChunkAt = lastChunkAt
      result.finalResponse = state.text
      result.finalLen = state.len
      console.log(`\n  ✓ 响应完成: ${state.len} 字符, 总耗时 ${lastChunkAt}ms`)
      break
    }
    await wait(800)
  }

  await win.screenshot({ path: join(OUT, '14-chat-final-response.png') })

  // 写报告
  const reportPath = join(OUT, 'chat-llm-report.md')
  writeFileSync(reportPath,
    `# Chat LLM 流式测试报告\n\n` +
    `- 模型: qwen3.5:9b (本地 Ollama)\n` +
    `- 提示词: "用一句话介绍 PiPiClaw 是什么"\n` +
    `- 首 chunk 延迟: ${result.firstChunkAt}ms\n` +
    `- 总耗时: ${result.lastChunkAt}ms\n` +
    `- 总字符: ${result.finalLen}\n` +
    `- chunk 增长次数: ${result.totalChunks}\n\n` +
    `## 完整响应\n\n` +
    `\`\`\`\n${result.finalResponse || '(空)'}\n\`\`\`\n`
  )

  console.log(`\n📁 报告: ${reportPath}`)
  console.log(`📁 截图: 10..14-chat-*.png`)

  await app.close()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
