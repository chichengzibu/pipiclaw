import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'

const TEST_USER_DATA = '/tmp/pipiclaw-llmclient-test'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => TEST_USER_DATA),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((s: string) => Buffer.from(s, 'utf-8')),
    decryptString: vi.fn((b: Buffer) => b.toString('utf-8')),
  },
}))

vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } },
  },
}))

/** Mock all 3 adapters with controlled chat fn so we can verify dispatch */
const openaiChat = vi.fn()
const anthropicChat = vi.fn()
const zhipuChat = vi.fn()
const publish = vi.fn()

vi.mock('../../../electron/llm/adapters/openai', () => ({
  OpenAiAdapter: class { chat = openaiChat },
}))
vi.mock('../../../electron/llm/adapters/anthropic', () => ({
  AnthropicAdapter: class { chat = anthropicChat },
}))
vi.mock('../../../electron/llm/adapters/zhipu', () => ({
  ZhipuAdapter: class { chat = zhipuChat },
}))
vi.mock('../../../electron/runtime/bridge/EventBus', () => ({
  EventBus: class {
    static getInstance() { return new (class { publish = publish; subscribe() { return () => {} } })() }
    publish = publish
    subscribe() { return () => {} }
  },
}))

async function freshClient() {
  const { LlmClient } = await import('../../../electron/llm/LlmClient')
  const { LlmConfigStore } = await import('../../../electron/llm/LlmConfigStore')
  ;(LlmClient as any).instance = null
  ;(LlmConfigStore as any).instance = null
  const store = LlmConfigStore.getInstance()
  const client = LlmClient.getInstance()
  return { client, store }
}

describe('LlmClient', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
    openaiChat.mockReset()
    anthropicChat.mockReset()
    zhipuChat.mockReset()
    publish.mockReset()
    openaiChat.mockResolvedValue({ ok: true, provider: 'openai', content: 'ok-openai', model: 'gpt-4o-mini', durationMs: 1 })
    anthropicChat.mockResolvedValue({ ok: true, provider: 'anthropic', content: 'ok-ant', model: 'claude', durationMs: 2 })
    zhipuChat.mockResolvedValue({ ok: true, provider: 'zhipu', content: 'ok-zhipu', model: 'glm', durationMs: 3 })
  })

  it('chat returns ok=false when no provider configured and no active', async () => {
    const { client } = await freshClient()
    const res = await client.chat({ model: 'x', messages: [{ role: 'user', content: 'hi' }] })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('no LLM provider')
  })

  it('chat uses provider from request when explicitly specified', async () => {
    const { client, store } = await freshClient()
    store.set('anthropic', { apiKey: 'k', enabled: true })
    const res = await client.chat({
      model: 'claude-3',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'anthropic',
    })
    expect(res.ok).toBe(true)
    expect(anthropicChat).toHaveBeenCalledTimes(1)
    expect(openaiChat).not.toHaveBeenCalled()
    expect(zhipuChat).not.toHaveBeenCalled()
  })

  it('chat dispatches to openai adapter', async () => {
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: 'k', enabled: true })
    const res = await client.chat({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
    })
    expect(openaiChat).toHaveBeenCalledTimes(1)
    expect(res.content).toBe('ok-openai')
  })

  it('chat dispatches to zhipu adapter', async () => {
    const { client, store } = await freshClient()
    store.set('zhipu', { apiKey: 'k', enabled: true })
    const res = await client.chat({
      model: 'glm',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'zhipu',
    })
    expect(zhipuChat).toHaveBeenCalledTimes(1)
    expect(res.content).toBe('ok-zhipu')
  })

  it('chat falls back to LlmConfigStore.getActive() when provider not specified', async () => {
    const { client, store } = await freshClient()
    store.set('anthropic', { apiKey: 'k', enabled: true })
    const res = await client.chat({
      model: '',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(anthropicChat).toHaveBeenCalledTimes(1)
    expect(res.provider).toBe('anthropic')
  })

  it('chat returns error when provider config is disabled', async () => {
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: 'k', enabled: false })
    const res = await client.chat({
      model: 'gpt',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('not enabled')
    expect(openaiChat).not.toHaveBeenCalled()
  })

  it('chat returns error when apiKey missing', async () => {
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: '', enabled: true })
    const res = await client.chat({
      model: 'gpt',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('apiKey missing')
  })

  it('publishes llm:request and llm:response events on success', async () => {
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: 'k', enabled: true })
    await client.chat({
      model: 'gpt',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
    })
    const topics = publish.mock.calls.map(c => c[0])
    expect(topics).toContain('llm:request')
    expect(topics).toContain('llm:response')
  })

  it('publishes llm:error event when adapter returns ok=false', async () => {
    openaiChat.mockResolvedValueOnce({ ok: false, provider: 'openai', content: '', model: 'gpt', durationMs: 1, error: 'boom' })
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: 'k', enabled: true })
    await client.chat({
      model: 'gpt',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
    })
    const topics = publish.mock.calls.map(c => c[0])
    expect(topics).toContain('llm:request')
    expect(topics).toContain('llm:error')
  })

  it('complete builds messages array from prompt + system', async () => {
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: 'k', enabled: true })
    await client.complete('hello world', { provider: 'openai', system: 'be brief', maxTokens: 100, temperature: 0.5 })
    expect(openaiChat).toHaveBeenCalledTimes(1)
    const [, req] = openaiChat.mock.calls[0]
    expect(req.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hello world' },
    ])
    expect(req.maxTokens).toBe(100)
    expect(req.temperature).toBe(0.5)
  })

  it('complete without system yields just user message', async () => {
    const { client, store } = await freshClient()
    store.set('openai', { apiKey: 'k', enabled: true })
    await client.complete('just prompt', { provider: 'openai' })
    const [, req] = openaiChat.mock.calls[0]
    expect(req.messages).toEqual([{ role: 'user', content: 'just prompt' }])
  })

  afterEach(() => {
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })
})