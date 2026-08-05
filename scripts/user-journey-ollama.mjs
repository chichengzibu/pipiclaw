#!/usr/bin/env node
/**
 * PiPiClaw - 真实用户全套功能测试 (electron prod + Ollama)
 *
 * 跑 prod build (dist-electron/main.js), 模拟用户用本地 Ollama 跑全功能.
 */

import { _electron as electron } from 'playwright'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as wait } from 'node:timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(__dirname, '..')
const mainEntry = path.join(PROJECT, 'dist-electron', 'main.js')
const OUT = 'user-journey-ollama'
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const results = { startTime: new Date().toISOString(), tests: [] }
function record(name, status, dur, extra = {}) {
  results.tests.push({ name, status, durationMs: dur, ...extra })
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️'
  const note = extra.note ? ` — ${extra.note}` : ''
  const err = extra.error ? ` [${extra.error.slice(0, 200)}]` : ''
  console.log(`${emoji} ${name} (${dur}ms)${note}${err}`)
}
async function test(name, fn) {
  const start = Date.now()
  try { const r = await fn(); record(name, 'PASS', Date.now() - start, r || {}); return r }
  catch (e) { record(name, 'FAIL', Date.now() - start, { error: String(e).slice(0, 200) }); return null }
}

async function main() {
  console.log(`\n=== PiPiClaw 用户全套功能测试 (electron prod + Ollama 11434) ===\n`)

  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox'],
    cwd: PROJECT,
    env: { ...process.env, PIPICLAW_E2E: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
  })

  const win = await app.firstWindow({ timeout: 30_000 })
  await win.waitForLoadState('domcontentloaded')
  await win.waitForSelector('#app', { timeout: 15_000 })
  await win.setViewportSize({ width: 1440, height: 900 })

  // 0. 清理 stale localStorage (上轮 e2e 残留的 provider_xxx ID 已不存在)
  await win.evaluate(() => {
    localStorage.removeItem('lastProviderId')
    localStorage.removeItem('lastModelId')
    localStorage.removeItem('currentProviderId')
    localStorage.removeItem('currentModelId')
  })
  await win.reload()
  await win.waitForSelector('#app', { timeout: 15_000 })
  await win.waitForTimeout(2000)

  // ============================================================
  // 1. 14 路由可达
  // ============================================================
  console.log('\n--- 1. 14 路由可达 ---')
  const routes = [
    '/dashboard', '/chat', '/skills', '/models', '/tasks',
    '/im-management', '/schedule', '/permissions', '/settings',
    '/help', '/clawhub', '/model-compare', '/plugin-market', '/remote-control'
  ]
  for (const r of routes) {
    await test(`route: ${r}`, async () => {
      await win.evaluate((h) => { window.location.hash = h; }, r)
      await win.waitForTimeout(350)
      const url = await win.evaluate(() => window.location.hash)
      if (!url.includes(r.replace('/', ''))) throw new Error(`URL=${url}`)
    })
  }
  await win.evaluate(() => { window.location.hash = '#/dashboard' })
  await win.waitForTimeout(500)
  await win.screenshot({ path: join(OUT, '01-dashboard.png') })

  // ============================================================
  // 2. Models
  // ============================================================
  console.log('\n--- 2. Models provider 列表 + 测试连接 ---')
  await win.evaluate(() => { window.location.hash = '#/models' })
  await win.waitForTimeout(1500)
  await win.screenshot({ path: join(OUT, '02-models.png') })

  await test('Models 页有 provider 列表', async () => {
    // 用 className 前缀匹配 (vue scoped class)
    const n = await win.evaluate(() => {
      const all = document.querySelectorAll('[class*="provider"]')
      return all.length
    })
    if (n === 0) throw new Error('没找到任何 provider 元素')
    return { note: `${n} provider 相关元素` }
  })

  await test('Models 点 "测试连接" 按钮', async () => {
    const btn = win.locator('button:has-text("测试连接")').first()
    if (await btn.count() === 0) throw new Error('没找到测试连接按钮')
    await btn.click()
    await win.waitForTimeout(3000)
    await win.screenshot({ path: join(OUT, '03-ollama-test.png') })
    return { note: '点击完成' }
  })

  // ============================================================
  // 3. Chat 真实 LLM
  // ============================================================
  console.log('\n--- 3. Chat 真实 LLM 流式 (qwen3.5:9b) ---')
  await win.evaluate(() => { window.location.hash = '#/chat' })
  await win.waitForTimeout(1500)
  await win.screenshot({ path: join(OUT, '04-chat-empty.png') })

  await test('Chat: 新建对话 + 输入 + 发送 + 等待 LLM 响应', async () => {
    // 0. 清 stale + 设 Ollama
    await win.evaluate(() => {
      localStorage.setItem('lastProviderId', 'provider_ollama_default')
      localStorage.setItem('lastModelId', 'qwen3.5:9b')
    })
    await win.reload()
    await win.waitForSelector('#app', { timeout: 15_000 })
    await win.waitForTimeout(2000)

    // 1. 通过 Pinia store 直接设 lastProviderId + lastModelId (避开 stale currentConv)
    await win.evaluate(() => {
      const app = document.querySelector('#app').__vue_app__
      const pinia = app.config.globalProperties.$pinia
      const chat = pinia._s.get('chat')
      // 直接 mutate Pinia state
      chat.lastProviderId = 'provider_ollama_default'
      chat.lastModelId = 'qwen3.5:9b'
      // 清空当前对话的 providerId (它是 stale)
      if (chat.currentConversation) {
        chat.currentConversation.providerId = 'provider_ollama_default'
        chat.currentConversation.modelId = 'qwen3.5:9b'
      }
    })
    await win.waitForTimeout(500)

    // 2. 点 "新建对话"
    const newChatBtn = win.locator('button:has-text("新建对话")').first()
    if (await newChatBtn.count() > 0) {
      await newChatBtn.click()
      await win.waitForTimeout(2000)
    }
    // 2. 等 textarea
    let waited = 0
    while (waited < 8000 && (await win.locator('textarea').count() === 0)) {
      await wait(500); waited += 500
    }
    if (await win.locator('textarea').count() === 0) throw new Error('textarea 仍未出现 (新建对话后)')
    // 3. 输入
    await win.locator('textarea').first().fill('用一句话介绍 PiPiClaw 是什么')
    await win.waitForTimeout(300)
    // 4. 发送 (Enter)
    await win.locator('textarea').first().press('Enter')
    await win.waitForTimeout(1500)
    await win.screenshot({ path: join(OUT, '05-chat-sent.png') })

    // 5. 等 LLM 流式响应
    console.log('  ⏳ 等 LLM 响应 (qwen3.5:9b 23s 典型)...')
    const startWait = Date.now()
    let firstChunkAt = null
    let lastChunkAt = null
    let lastTextLen = 0
    let chunks = 0
    let finalText = ''
    let sawGenerating = false
    while (Date.now() - startWait < 120000) {
      const state = await win.evaluate(() => {
        const messages = document.querySelectorAll('[class*="message"]')
        let lastAssistant = null
        for (const m of messages) {
          if (m.className && m.className.includes('assistant')) lastAssistant = m
        }
        if (!lastAssistant && messages.length > 0) lastAssistant = messages[messages.length - 1]
        if (!lastAssistant) return { found: false }
        const text = (lastAssistant.textContent || '').trim()
        // 找 "生成中" 状态 (说明 LLM 真的在跑)
        const generating = document.body.textContent.includes('生成中') ||
                            document.body.textContent.includes('Generating') ||
                            !!document.querySelector('.typing-cursor, [class*="streaming"]')
        return { found: true, text, len: text.length, generating }
      })

      if (state.generating && !sawGenerating) {
        sawGenerating = true
        console.log(`  ✓ 检测到 "生成中" 状态`)
      }

      if (state.found && state.len > 0) {
        if (!firstChunkAt) {
          firstChunkAt = Date.now() - startWait
          console.log(`  ✓ 首 chunk: ${firstChunkAt}ms (${state.len} 字符)`)
        }
        if (state.len > lastTextLen) {
          chunks++
          lastTextLen = state.len
          lastChunkAt = Date.now() - startWait
          finalText = state.text
        }
      }

      // 完成判断: (1) generating 消失 + text > 50 字符, (2) 或 5s 无增长
      if (firstChunkAt && lastChunkAt && (Date.now() - lastChunkAt) > 5000 && !state.generating) {
        console.log(`  ✓ 响应完成: ${state.len} 字符, 总 ${lastChunkAt}ms, ${chunks} chunks`)
        break
      }
      if (firstChunkAt && lastChunkAt && lastTextLen > 100 && (Date.now() - lastChunkAt) > 5000) {
        console.log(`  ✓ 响应完成 (>100 字符, 5s 无增长): ${state.len} 字符, ${chunks} chunks`)
        break
      }
      await wait(700)
    }
    if (!firstChunkAt && !sawGenerating) throw new Error('120s 内没收到 LLM 响应')

    await win.screenshot({ path: join(OUT, '06-chat-response.png') })
    writeFileSync(join(OUT, 'chat-response.txt'),
      `首 chunk: ${firstChunkAt}ms\n总耗时: ${lastChunkAt}ms\n字符: ${lastTextLen}\nchunks: ${chunks}\n\n` +
      `=== 完整响应 ===\n${finalText}\n`
    )
    return {
      note: `首 chunk ${firstChunkAt}ms, 总 ${lastChunkAt}ms, ${lastTextLen} 字符, ${chunks} chunks`
    }
  })

  // ============================================================
  // 4. Skills
  // ============================================================
  console.log('\n--- 4. Skills 列表 ---')
  await win.evaluate(() => { window.location.hash = '#/skills' })
  await win.waitForTimeout(2000)
  await win.screenshot({ path: join(OUT, '07-skills.png') })

  await test('Skills 列表加载', async () => {
    const n = await win.evaluate(() => {
      return document.querySelectorAll('[class*="skill"]').length
    })
    if (n === 0) throw new Error('没找到 skill 元素')
    return { note: `${n} skill 相关元素` }
  })

  // ============================================================
  // 5. Settings
  // ============================================================
  console.log('\n--- 5. Settings 切主题 ---')
  await win.evaluate(() => { window.location.hash = '#/settings' })
  await win.waitForTimeout(1500)
  await win.screenshot({ path: join(OUT, '08-settings.png') })

  await test('Settings 切换深色主题', async () => {
    const btn = win.locator('button.radio:has-text("深色")').first()
    if (await btn.count() === 0) throw new Error('深色按钮未找到')
    await btn.click()
    await win.waitForTimeout(400)
    const t = await win.evaluate(() => document.documentElement.getAttribute('data-theme'))
    if (t !== 'dark') throw new Error(`data-theme=${t}`)
    return { note: `data-theme=${t}` }
  })

  await test('Settings 切回浅色', async () => {
    const btn = win.locator('button.radio:has-text("浅色")').first()
    await btn.click()
    await win.waitForTimeout(400)
    const t = await win.evaluate(() => document.documentElement.getAttribute('data-theme'))
    if (t !== 'light') throw new Error(`data-theme=${t}`)
    return { note: `data-theme=${t}` }
  })

  // ============================================================
  // 6. CommandPalette
  // ============================================================
  console.log('\n--- 6. CommandPalette Ctrl+K ---')
  await test('CommandPalette 打开 + 关闭', async () => {
    await win.keyboard.press('Control+k')
    await win.waitForTimeout(800)
    const open = await win.evaluate(() => !!document.querySelector('.palette, [class*="palette"]'))
    if (!open) throw new Error('Ctrl+K 未打开')
    await win.screenshot({ path: join(OUT, '09-palette.png') })
    await win.keyboard.press('Escape')
    await win.waitForTimeout(300)
    return { note: 'Ctrl+K 打开成功' }
  })

  // ============================================================
  // 7. SideNav 跳转
  // ============================================================
  console.log('\n--- 7. SideNav 6 核心 icon 跳转 ---')
  for (const r of ['/chat', '/skills', '/models', '/dashboard']) {
    await test(`SideNav → ${r}`, async () => {
      const link = win.locator(`.sidenav a[href*="${r}"]`).first()
      if (await link.count() === 0) throw new Error(`sidenav 找不到 ${r}`)
      await link.click()
      await win.waitForTimeout(700)
      const url = await win.evaluate(() => window.location.hash)
      if (!url.includes(r.replace('/', ''))) throw new Error(`URL=${url}`)
    })
  }

  // ============================================================
  // 8. 其他路由可达
  // ============================================================
  console.log('\n--- 8. 其他路由 quick test ---')
  for (const r of ['/tasks', '/im-management', '/schedule', '/permissions', '/clawhub', '/help']) {
    await test(`其他 route: ${r}`, async () => {
      await win.evaluate((h) => { window.location.hash = h; }, r)
      await win.waitForTimeout(300)
      const url = await win.evaluate(() => window.location.hash)
      if (!url.includes(r.replace('/', ''))) throw new Error(`URL=${url}`)
    })
  }

  // ============================================================
  // 报告
  // ============================================================
  const pass = results.tests.filter(t => t.status === 'PASS').length
  const fail = results.tests.filter(t => t.status === 'FAIL').length
  const total = results.tests.length
  results.endTime = new Date().toISOString()
  results.summary = { total, pass, fail }

  console.log(`\n=== 总结: ${pass}/${total} pass, ${fail} fail ===\n`)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(results, null, 2))
  writeFileSync(join(OUT, 'report.md'),
    `# PiPiClaw 用户全套功能测试报告 (Ollama 本地链路)\n\n` +
    `- 开始: ${results.startTime}\n` +
    `- 结束: ${results.endTime}\n` +
    `- 结果: **${pass}/${total} pass, ${fail} fail**\n\n` +
    `## 测试清单\n\n` +
    results.tests.map(t => `- ${t.status === 'PASS' ? '✅' : '❌'} **${t.name}** (${t.durationMs}ms)${t.note ? ' — ' + t.note : ''}${t.error ? '\n  - 错误: `' + t.error + '`' : ''}`).join('\n')
  )

  await app.close()
  console.log(`\n📁 报告: ${OUT}/report.md + ${results.tests.length} 测试`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
