// PiPiClaw + Ollama 真链路 e2e
// 验证 LlmClient 走 OpenAI adapter 接 Ollama
// 输出:速度 / 工具调用 / 流式 / 错误处理 等真实指标

import { LlmConfigStore } from '../electron/llm/LlmConfigStore.js'
import { LlmClient } from '../electron/llm/LlmClient.js'
import { app } from 'electron' // 会 mock

// Mock electron app for LlmConfigStore
const mockUserData = 'D:\\tmp\\pipiclaw-ollama-test'
// 用 Node fs 写 config
import * as fs from 'node:fs'
import * as path from 'node:path'

if (!fs.existsSync(mockUserData)) fs.mkdirSync(mockUserData, { recursive: true })

// 直接 mock app.getPath
;(globalThis as any).__appMock = {
  getPath: (key: string) => {
    if (key === 'userData') return mockUserData
    return mockUserData
  },
}

const OLLAMA_BASE = 'http://localhost:11434/v1'
const MODEL = process.argv[2] || 'qwen3.5:9b'

async function setup() {
  const store = LlmConfigStore.getInstance()
  // 配一个 custom OpenAI provider 指向 Ollama
  store.upsert({
    provider: 'openai',
    apiKey: 'ollama-no-key-needed',
    apiBaseUrl: OLLAMA_BASE,
    defaultModel: MODEL,
    enabled: true,
  })
  store.setActive('openai')
  console.log('✓ Configured PiPiClaw LLM provider = openai → Ollama @', OLLAMA_BASE)
  console.log('  defaultModel =', MODEL)
}

async function runScenarios() {
  const client = LlmClient.getInstance()

  console.log('\n' + '='.repeat(60))
  console.log('  真实场景测试')
  console.log('='.repeat(60))

  // S1: 简单问答
  console.log('\n[S1] 简单问答 — "用一句话解释 PiPiClaw"')
  const t1 = Date.now()
  const r1 = await client.chat({
    model: MODEL,
    messages: [{ role: 'user', content: '用一句话(不超过 50 字)解释 PiPiClaw 是什么' }],
    maxTokens: 200,
    temperature: 0.7,
  })
  console.log(`  ⏱  ${Date.now() - t1}ms`)
  console.log(`  ok: ${r1.ok}, content: ${r1.content.slice(0, 200)}`)
  console.log(`  duration: ${r1.durationMs}ms, model: ${r1.model}`)
  if (r1.usage) {
    console.log(`  usage: prompt=${r1.usage.promptTokens} completion=${r1.usage.completionTokens} total=${r1.usage.totalTokens}`)
  }

  // S2: 工具调用
  console.log('\n[S2] 工具调用 — "北京今天天气怎么样?"')
  const t2 = Date.now()
  const r2 = await client.chat({
    model: MODEL,
    messages: [{ role: 'user', content: '北京今天天气怎么样?' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: '获取指定城市的天气',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string', description: '城市名' } },
            required: ['city'],
          },
        },
      },
    ],
    maxTokens: 200,
  })
  console.log(`  ⏱  ${Date.now() - t2}ms`)
  console.log(`  ok: ${r2.ok}, content: ${r2.content.slice(0, 200)}`)
  if ((r2 as any).toolCalls) {
    console.log(`  toolCalls:`, JSON.stringify((r2 as any).toolCalls))
  } else {
    console.log(`  (注:当前 PiPiClaw LlmClient 未透传 tool_calls,需后续增强)`)
  }

  // S3: 长 prompt(模拟实际使用)
  console.log('\n[S3] 长 prompt — 200 字的 PR 描述')
  const t3 = Date.now()
  const r3 = await client.chat({
    model: MODEL,
    messages: [
      { role: 'system', content: '你是 PiPiClaw,一个简洁的桌面 AI 助手' },
      { role: 'user', content: '帮我写一段 200 字的 PR 描述,主题是:统一 5 套主题为 light/dark 双主题' },
    ],
    maxTokens: 400,
  })
  console.log(`  ⏱  ${Date.now() - t3}ms`)
  console.log(`  ok: ${r3.ok}, content length: ${r3.content.length}`)
  console.log(`  --- content ---`)
  console.log(`  ${r3.content.slice(0, 300)}`)
  console.log(`  --- end ---`)

  // S4: 多轮上下文
  console.log('\n[S4] 多轮上下文 — 3 轮对话')
  let ctx: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: '你是 PiPiClaw,一个简洁的桌面 AI 助手' },
    { role: 'user', content: '我叫什么?' },
  ]
  const r4a = await client.chat({ model: MODEL, messages: ctx, maxTokens: 100 })
  console.log(`  T1: ${r4a.content}  (${r4a.durationMs}ms)`)
  ctx.push({ role: 'assistant', content: r4a.content })
  ctx.push({ role: 'user', content: '我叫小明,做 Python 后端' })
  const r4b = await client.chat({ model: MODEL, messages: ctx, maxTokens: 100 })
  console.log(`  T2: ${r4b.content}  (${r4b.durationMs}ms)`)
  ctx.push({ role: 'assistant', content: r4b.content })
  ctx.push({ role: 'user', content: '你还记得我叫什么?做什么的?' })
  const r4c = await client.chat({ model: MODEL, messages: ctx, maxTokens: 100 })
  console.log(`  T3: ${r4c.content}  (${r4c.durationMs}ms)`)
  // 验证上下文保留
  const rememberName = r4c.content.includes('小明')
  console.log(`  ✓ 记住名字: ${rememberName ? 'YES' : 'NO'}`)

  // S5: 错误处理(模型不存在)
  console.log('\n[S5] 错误处理 — 不存在的模型')
  const r5 = await client.chat({
    model: 'nonexistent-model-xxx',
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 50,
  })
  console.log(`  ok: ${r5.ok}`)
  console.log(`  error: ${(r5.error || '').slice(0, 200)}`)

  // S6: 流式支持
  console.log('\n[S6] 流式 — 写一首关于秋天的小诗')
  const t6 = Date.now()
  let firstChunkAt: number | null = null
  let chunks = 0
  let streamed = ''
  try {
    const res = await fetch(`${OLLAMA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: '写一首 4 句关于秋天的小诗' }],
        stream: true,
        max_tokens: 200,
      }),
    })
    if (!res.ok || !res.body) {
      console.log(`  ✗ fetch failed: HTTP ${res.status}`)
    } else {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (firstChunkAt === null) firstChunkAt = Date.now() - t6
        chunks++
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n').filter(Boolean)) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            if (payload === '[DONE]') continue
            try {
              const j = JSON.parse(payload)
              const d = j.choices?.[0]?.delta?.content
              if (d) streamed += d
            } catch {}
          }
        }
      }
      console.log(`  ⏱  TTFB ${firstChunkAt}ms, total ${Date.now() - t6}ms, ${chunks} chunks`)
      console.log(`  ---`)
      console.log(`  ${streamed}`)
      console.log(`  ---`)
    }
  } catch (e) {
    console.log(`  ✗ stream error: ${e}`)
  }

  // 总结
  console.log('\n' + '='.repeat(60))
  console.log('  总结报告')
  console.log('='.repeat(60))
  console.log(`  S1 简单问答:     ${r1.ok ? '✓' : '✗'}  ${r1.durationMs}ms`)
  console.log(`  S2 工具调用:     ${r2.ok ? '✓' : '✗'}  ${r2.durationMs}ms  (注:LlmClient 未透传 tool_calls)`)
  console.log(`  S3 长 prompt:    ${r3.ok ? '✓' : '✗'}  ${r3.durationMs}ms`)
  console.log(`  S4 多轮上下文:   ${rememberName ? '✓' : '✗'}  记住名字:${r4c.durationMs}ms`)
  console.log(`  S5 错误处理:     ${!r5.ok ? '✓' : '✗'}  ${r5.error?.slice(0, 60)}`)
  console.log(`  S6 流式响应:     ${streamed ? '✓' : '✗'}  TTFB ${firstChunkAt}ms`)
  console.log('='.repeat(60))
}

setup().then(runScenarios).catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
