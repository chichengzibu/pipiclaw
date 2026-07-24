// PiPiClaw + Ollama 真链路集成测试
// 跑 6 个真实场景,验证 LlmClient 在 Ollama 上的表现

import { describe, it, expect, beforeAll } from 'vitest'
import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((k: string) => `/tmp/pipiclaw-ollama-test-${k}`),
    getName: () => 'pipiclaw',
    getVersion: () => '4.2.0',
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((s: string) => Buffer.from(s, 'utf-8')),
    decryptString: vi.fn((b: Buffer) => b.toString('utf-8')),
  },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { LlmConfigStore } from '../../electron/llm/LlmConfigStore'
import { LlmClient } from '../../electron/llm/LlmClient'

const OLLAMA_BASE = 'http://localhost:11434/v1'
const MODEL = process.env.OLLAMA_MODEL || 'qwen3:14b'

describe('P5-UX: PiPiClaw + Ollama 真链路 e2e', () => {
  beforeAll(async () => {
    const store = LlmConfigStore.getInstance()
    store.set('openai', {
      apiKey: 'ollama-no-key-needed',
      apiBaseUrl: OLLAMA_BASE,
      defaultModel: MODEL,
      enabled: true,
    })

    // 确认 ollama 在
    const r = await fetch('http://localhost:11434/api/version')
    expect(r.ok).toBe(true)
  })

  it('S1: 简单问答', async () => {
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: MODEL,
      messages: [{ role: 'user', content: '用一句话(不超过 50 字)解释 PiPiClaw' }],
      maxTokens: 200,
      temperature: 0.7,
    })
    expect(r.ok).toBe(true)
    expect(r.content.length).toBeGreaterThan(0)
    console.log(`  S1: ${r.durationMs}ms, content="${r.content.slice(0, 100)}"`)
    if (r.usage) {
      console.log(`  S1 usage: prompt=${r.usage.promptTokens} completion=${r.usage.completionTokens}`)
    }
  }, 60000)

  it('S2: 工具调用(基础协议验证)', async () => {
    const client = LlmClient.getInstance()
    const r = await client.chat({
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
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
          },
        },
      ],
      maxTokens: 200,
    })
    // LlmClient 的 openai adapter 暂未透传 tool_calls
    expect(r.ok).toBe(true)
    console.log(`  S2: ${r.durationMs}ms, content="${r.content.slice(0, 100)}"`)
    console.log(`  S2 note: 当前 LlmClient 不解析 tool_calls,需后续增强`)
  }, 60000)

  it('S3: 长 prompt', async () => {
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是 PiPiClaw,简洁桌面 AI 助手' },
        { role: 'user', content: '帮我写 200 字 PR 描述,主题:统一 5 套主题为 light/dark' },
      ],
      maxTokens: 400,
    })
    expect(r.ok).toBe(true)
    expect(r.content.length).toBeGreaterThan(20)
    console.log(`  S3: ${r.durationMs}ms, ${r.content.length} chars`)
  }, 60000)

  it('S4: 多轮上下文保留', async () => {
    const client = LlmClient.getInstance()
    const ctx: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: '你是 PiPiClaw' },
      { role: 'user', content: '我叫什么?' },
    ]
    const r1 = await client.chat({ model: MODEL, messages: ctx, maxTokens: 80 })
    ctx.push({ role: 'assistant', content: r1.content })
    ctx.push({ role: 'user', content: '我叫小明,做 Python' })
    const r2 = await client.chat({ model: MODEL, messages: ctx, maxTokens: 80 })
    ctx.push({ role: 'assistant', content: r2.content })
    ctx.push({ role: 'user', content: '你还记得我叫什么?' })
    const r3 = await client.chat({ model: MODEL, messages: ctx, maxTokens: 80 })
    const remember = r3.content.includes('小明')
    console.log(`  S4 R1: ${r1.durationMs}ms "${r1.content.slice(0, 50)}"`)
    console.log(`  S4 R2: ${r2.durationMs}ms "${r2.content.slice(0, 50)}"`)
    console.log(`  S4 R3: ${r3.durationMs}ms "${r3.content.slice(0, 50)}"`)
    console.log(`  S4 记住名字: ${remember ? 'YES' : 'NO'}`)
    expect(remember).toBe(true)
  }, 120000)

  it('S5: 错误处理 — 不存在的模型', async () => {
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: 'nonexistent-model-xxx',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBeDefined()
    console.log(`  S5 error: ${(r.error || '').slice(0, 150)}`)
  }, 30000)

  it('S6: 流式响应(直接走 Ollama API,带 reasoning 兼容)', async () => {
    const start = Date.now()
    let firstChunkAt: number | null = null
    let chunks = 0
    let content = ''
    let reasoning = ''
    const res = await fetch(`${OLLAMA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: '写一首 4 句关于秋天的小诗' }],
        stream: true,
        max_tokens: 500,
      }),
    })
    expect(res.ok).toBe(true)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (firstChunkAt === null) firstChunkAt = Date.now() - start
      chunks++
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n').filter(Boolean)) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          try {
            const j = JSON.parse(payload)
            const d = j.choices?.[0]?.delta
            if (d?.content) content += d.content
            if (d?.reasoning) reasoning += d.reasoning
          } catch {}
        }
      }
    }
    const total = content.length + reasoning.length
    console.log(`  S6: TTFB ${firstChunkAt}ms, total ${Date.now() - start}ms, ${chunks} chunks`)
    console.log(`  S6 content: ${content.length} chars, reasoning: ${reasoning.length} chars`)
    if (content) console.log(`  S6 content 预览: ${content.slice(0, 100)}`)
    if (reasoning && !content) console.log(`  S6 reasoning 预览: ${reasoning.slice(0, 100)}`)
    expect(total).toBeGreaterThan(10)
  }, 60000)
})
