// P5-UX E: Ollama 宕机 / 网络异常 / 错误模型 — PiPiClaw 降级 UX
import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((k: string) => `/tmp/pipiclaw-ollama-fail-${k}`),
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

const DEAD_URL = 'http://localhost:11435/v1' // 故意不存在的端口
const ALIVE_URL = 'http://localhost:11434/v1'
const MODEL = 'qwen3:14b'

describe('P5-UX E: Ollama 宕机降级', () => {
  it('E1: 端口不可达 → ok:false + 友好 error', async () => {
    const store = LlmConfigStore.getInstance()
    store.set('openai', { apiKey: 'x', apiBaseUrl: DEAD_URL, defaultModel: MODEL, enabled: true })
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBeDefined()
    console.log(`  E1: ${r.durationMs}ms, error: ${(r.error || '').slice(0, 100)}`)
    // 验证 error 信息对用户友好(不是栈)
    expect(r.error).not.toContain('at ')
    expect(r.error).not.toContain('.ts:')
  }, 10000)

  it('E2: 协议不对(url 是根路径而不是 /v1)→ ok:false', async () => {
    const store = LlmConfigStore.getInstance()
    store.set('openai', { apiKey: 'x', apiBaseUrl: 'http://localhost:11434', defaultModel: MODEL, enabled: true })
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    expect(r.ok).toBe(false)
    console.log(`  E2: error: ${(r.error || '').slice(0, 100)}`)
  }, 10000)

  it('E3: 黑洞地址 → ok:false + 不卡死(用 127.0.0.1:1 模拟不可达,避免污染后续测试)', async () => {
    const store = LlmConfigStore.getInstance()
    // 用 localhost:1 (几乎肯定不可达,不会卡 30s)
    store.set('openai', {
      apiKey: 'x',
      apiBaseUrl: 'http://127.0.0.1:1/v1',
      defaultModel: MODEL,
      enabled: true,
    })
    const client = LlmClient.getInstance()
    const start = Date.now()
    const r = await client.chat({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    const elapsed = Date.now() - start
    expect(r.ok).toBe(false)
    console.log(`  E3: ${elapsed}ms`)
    // 等长一点确保连接资源被释放
    await new Promise((r) => setTimeout(r, 200))
  }, 10000)

  it('E4: 空 apiKey → 友好错误,不调 API', async () => {
    const store = LlmConfigStore.getInstance()
    store.set('openai', { apiKey: '', apiBaseUrl: ALIVE_URL, defaultModel: MODEL, enabled: true })
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    expect(r.ok).toBe(false)
    // getActive() 在 apiKey 为空时返回 undefined,触发"no LLM provider"
    // 或者:config 存在但 apiKey 空,触发"not enabled or apiKey missing"
    const errorOk = r.error?.includes('no LLM provider') || r.error?.includes('apiKey missing')
    expect(errorOk).toBe(true)
    console.log(`  E4: ${r.durationMs}ms, error: ${(r.error || '').slice(0, 100)}`)
  })

  it('E5: 模型不存在 → HTTP 404 透传', async () => {
    // 先重置 store(避免 E3 / E4 状态污染)
    const store = LlmConfigStore.getInstance()
    store.set('openai', { apiKey: 'x', apiBaseUrl: ALIVE_URL, defaultModel: MODEL, enabled: true })
    const client = LlmClient.getInstance()
    // 调试:确认 store 状态
    const active = store.getActive()
    const allConfigs = store.list().map((c) => `${c.provider}:${c.apiBaseUrl}`)
    console.log(`  E5 active: apiBase=${active?.apiBaseUrl}, model=${active?.defaultModel}, enabled=${active?.enabled}`)
    console.log(`  E5 allConfigs: ${allConfigs.join(' | ')}`)
    await new Promise((r) => setTimeout(r, 200))
    const r = await client.chat({
      model: 'nonexistent-model-xxx',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    expect(r.ok).toBe(false)
    const errorOk = r.error?.includes('404') || r.error?.includes('not found')
    expect(errorOk).toBe(true)
    console.log(`  E5: error: ${(r.error || '').slice(0, 150)}`)
  }, 30000)

  it('E6: 没有任何 provider 启用 → 友好错误', async () => {
    const store = LlmConfigStore.getInstance()
    store.set('openai', { apiKey: '', apiBaseUrl: ALIVE_URL, defaultModel: MODEL, enabled: false })
    const client = LlmClient.getInstance()
    const r = await client.chat({
      model: MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 50,
    })
    expect(r.ok).toBe(false)
    console.log(`  E6: ${r.durationMs}ms, error: ${(r.error || '').slice(0, 100)}`)
  })
})
