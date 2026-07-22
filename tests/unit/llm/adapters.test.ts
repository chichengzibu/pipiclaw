import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/pipiclaw-adapters-test'),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
    isPackaged: false,
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

/** Helper to build a mocked Response object compatible with adapters' usage */
function mockResponse(opts: { ok: boolean; status?: number; json?: unknown; text?: string }) {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    json: vi.fn().mockResolvedValue(opts.json ?? {}),
    text: vi.fn().mockResolvedValue(opts.text ?? ''),
  } as unknown as Response
}

describe('OpenAiAdapter', () => {
  let fetchMock: any
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends POST to {baseUrl}/chat/completions with Bearer token', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      ok: true,
      json: { choices: [{ message: { content: 'hello' } }] },
    }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    const cfg = { provider: 'openai' as const, apiKey: 'sk-abc', enabled: true, updatedAt: 0 }
    const res = await adapter.chat(cfg, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user' as const, content: 'hi' }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(res.ok).toBe(true)
    expect(res.content).toBe('hello')
    expect(res.provider).toBe('openai')
  })

  it('uses custom apiBaseUrl when provided', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { choices: [{ message: { content: 'x' } }] } }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0, apiBaseUrl: 'https://proxy.example.com/v1' },
      { model: 'gpt', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.example.com/v1/chat/completions')
  })

  it('uses default model when request.model is empty', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { choices: [{ message: { content: 'x' } }] } }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    const res = await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: '', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.model).toBe('gpt-4o-mini')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('gpt-4o-mini')
  })

  it('uses config.defaultModel when set', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { choices: [{ message: { content: 'x' } }] } }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0, defaultModel: 'gpt-4o' },
      { model: '', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('gpt-4o')
  })

  it('serializes messages, temperature, max_tokens in body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { choices: [{ message: { content: 'x' } }] } }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'q' }], temperature: 0.3, maxTokens: 512 },
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'q' }])
    expect(body.temperature).toBe(0.3)
    expect(body.max_tokens).toBe(512)
  })

  it('returns ok=false with HTTP error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 401, text: 'invalid api key' }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    const res = await adapter.chat(
      { provider: 'openai', apiKey: 'bad', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('HTTP 401')
    expect(res.error).toContain('invalid api key')
  })

  it('parses usage tokens when present', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      ok: true,
      json: {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    const res = await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 })
  })

  it('handles network error (fetch rejection)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    const res = await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('network down')
  })

  it('falls back to empty content when response has no choices', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: {} }))
    const { OpenAiAdapter } = await import('../../../electron/llm/adapters/openai')
    const adapter = new OpenAiAdapter()
    const res = await adapter.chat(
      { provider: 'openai', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.content).toBe('')
  })
})

describe('AnthropicAdapter', () => {
  let fetchMock: any
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends POST to {baseUrl}/messages with x-api-key + anthropic-version headers', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { content: [{ text: 'reply' }] } }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    const res = await adapter.chat(
      { provider: 'anthropic', apiKey: 'sk-ant', enabled: true, updatedAt: 0 },
      { model: 'claude-3-5-sonnet-20241022', messages: [{ role: 'user', content: 'hi' }] },
    )
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-ant')
    expect(init.headers['anthropic-version']).toBe('2023-06-01')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(res.ok).toBe(true)
    expect(res.content).toBe('reply')
  })

  it('extracts system message into top-level system field', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { content: [{ text: 'reply' }] } }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [
        { role: 'system', content: 'be concise' },
        { role: 'user', content: 'hi' },
      ] },
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.system).toBe('be concise')
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('omits system field when no system message present', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { content: [{ text: 'r' }] } }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.system).toBeUndefined()
  })

  it('uses default anthropic model when request.model empty', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { content: [{ text: 'r' }] } }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    const res = await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: '', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.model).toBe('claude-3-5-sonnet-20241022')
  })

  it('returns ok=false on HTTP error', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 429, text: 'rate limit' }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    const res = await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('HTTP 429')
  })

  it('parses input_tokens/output_tokens into usage', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      ok: true,
      json: { content: [{ text: 'r' }], usage: { input_tokens: 5, output_tokens: 15 } },
    }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    const res = await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.usage).toEqual({ promptTokens: 5, completionTokens: 15, totalTokens: 20 })
  })

  it('handles network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    const res = await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('socket hang up')
  })

  it('uses custom apiBaseUrl when provided', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { content: [{ text: 'x' }] } }))
    const { AnthropicAdapter } = await import('../../../electron/llm/adapters/anthropic')
    const adapter = new AnthropicAdapter()
    await adapter.chat(
      { provider: 'anthropic', apiKey: 'k', enabled: true, updatedAt: 0, apiBaseUrl: 'https://proxy.ant/v1' },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.ant/v1/messages')
  })
})

describe('ZhipuAdapter', () => {
  let fetchMock: any
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends POST to zhipu chat/completions with Bearer token', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      ok: true,
      json: { choices: [{ message: { content: '智谱回复' } }] },
    }))
    const { ZhipuAdapter } = await import('../../../electron/llm/adapters/zhipu')
    const adapter = new ZhipuAdapter()
    const res = await adapter.chat(
      { provider: 'zhipu', apiKey: 'zhipu-key', enabled: true, updatedAt: 0 },
      { model: 'glm-4-flash', messages: [{ role: 'user', content: '你好' }] },
    )
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer zhipu-key')
    expect(res.content).toBe('智谱回复')
    expect(res.provider).toBe('zhipu')
  })

  it('uses default model glm-4-flash when none provided', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { choices: [{ message: { content: 'r' } }] } }))
    const { ZhipuAdapter } = await import('../../../electron/llm/adapters/zhipu')
    const adapter = new ZhipuAdapter()
    const res = await adapter.chat(
      { provider: 'zhipu', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: '', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.model).toBe('glm-4-flash')
  })

  it('returns ok=false on HTTP error', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 403, text: 'forbidden' }))
    const { ZhipuAdapter } = await import('../../../electron/llm/adapters/zhipu')
    const adapter = new ZhipuAdapter()
    const res = await adapter.chat(
      { provider: 'zhipu', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('HTTP 403')
  })

  it('parses usage tokens', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      ok: true,
      json: {
        choices: [{ message: { content: 'r' } }],
        usage: { prompt_tokens: 7, completion_tokens: 13, total_tokens: 20 },
      },
    }))
    const { ZhipuAdapter } = await import('../../../electron/llm/adapters/zhipu')
    const adapter = new ZhipuAdapter()
    const res = await adapter.chat(
      { provider: 'zhipu', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.usage).toEqual({ promptTokens: 7, completionTokens: 13, totalTokens: 20 })
  })

  it('handles fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'))
    const { ZhipuAdapter } = await import('../../../electron/llm/adapters/zhipu')
    const adapter = new ZhipuAdapter()
    const res = await adapter.chat(
      { provider: 'zhipu', apiKey: 'k', enabled: true, updatedAt: 0 },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('connection refused')
  })

  it('uses custom apiBaseUrl when provided', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, json: { choices: [{ message: { content: 'x' } }] } }))
    const { ZhipuAdapter } = await import('../../../electron/llm/adapters/zhipu')
    const adapter = new ZhipuAdapter()
    await adapter.chat(
      { provider: 'zhipu', apiKey: 'k', enabled: true, updatedAt: 0, apiBaseUrl: 'https://proxy.zhipu/v4' },
      { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.zhipu/v4/chat/completions')
  })
})