import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

import { setActivePinia, createPinia } from 'pinia'

const { api } = vi.hoisted(() => {
  const api: any = {}
  api.models = {
    list: vi.fn(),
    get: vi.fn(),
    getTemplates: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
    test: vi.fn(),
    syncOllama: vi.fn(),
    fetch: vi.fn(),
  }
  api.chat = {
    conversations: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    archiveConversation: vi.fn(),
    pinConversation: vi.fn(),
    sendMessage: vi.fn(),
    stopGeneration: vi.fn(),
    continueGeneration: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getLastModel: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onConversationUpdate: vi.fn(() => () => {}),
    onStreamUpdate: vi.fn(() => () => {}),
  }
  api.permissions = {
    list: vi.fn(),
    active: vi.fn(),
    get: vi.fn(),
    setActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateRule: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    check: vi.fn(),
  }
  api.schedule = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
    history: vi.fn(),
    execute: vi.fn(),
    cancel: vi.fn(),
  }
  api.gateway = {
    status: vi.fn(),
    logs: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    config: { get: vi.fn(), set: vi.fn() },
    onStatusChange: vi.fn(() => () => {}),
    onLog: vi.fn(() => () => {}),
  }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { api }
})

import {
  useModelsStore,
  PROVIDER_DEFAULTS,
  type ProviderConfig,
  type ModelInfo,
  type ModelTestResult,
  type ProviderFormData,
} from '../../../src/stores/models'

const now = 1700000000000

const makeProvider = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'p1',
  name: 'OpenAI',
  type: 'openai',
  enabled: true,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  models: [
    { id: 'gpt-4', name: 'GPT-4', provider: 'p1', capabilities: ['chat'] },
  ],
  defaultModel: 'gpt-4',
  timeout: 60000,
  maxRetries: 3,
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

describe('useModelsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  it('initializes with empty providers and templates', () => {
    const store = useModelsStore()
    expect(store.providers).toEqual([])
    expect(store.providerTemplates).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.testingProviders.size).toBe(0)
    expect(store.syncingProviders.size).toBe(0)
    expect(store.fetchingProviders.size).toBe(0)
    expect(store.enabledProviders).toEqual([])
    expect(store.disabledProviders).toEqual([])
    expect(store.enabledCount).toBe(0)
    expect(store.totalCount).toBe(0)
  })

  it('fetchProviders loads providers list', async () => {
    const store = useModelsStore()
    const p1 = makeProvider()
    const p2 = makeProvider({ id: 'p2', name: 'Anthropic', type: 'anthropic', enabled: false })
    api.models.list.mockResolvedValue({ success: true, data: [p1, p2] })
    await store.fetchProviders()
    expect(store.providers.length).toBe(2)
    expect(store.enabledProviders.map(p => p.id)).toEqual(['p1'])
    expect(store.disabledProviders.map(p => p.id)).toEqual(['p2'])
    expect(store.enabledCount).toBe(1)
    expect(store.totalCount).toBe(2)
    expect(store.loading).toBe(false)
  })

  it('fetchProviders handles failure silently', async () => {
    const store = useModelsStore()
    api.models.list.mockResolvedValue({ success: false })
    await store.fetchProviders()
    expect(store.providers).toEqual([])
  })

  it('fetchProviders catches thrown error', async () => {
    const store = useModelsStore()
    api.models.list.mockRejectedValue(new Error('IPC fail'))
    await store.fetchProviders()
    expect(store.loading).toBe(false)
  })

  it('fetchProviderTemplates loads backend templates when available', async () => {
    const store = useModelsStore()
    api.models.getTemplates.mockResolvedValue({
      success: true,
      data: [{ name: 'A', type: 'openai', defaultConfig: {} }],
    })
    await store.fetchProviderTemplates()
    expect(api.models.getTemplates).toHaveBeenCalledTimes(1)
    expect(store.providerTemplates.length).toBe(1)
  })

  it('fetchProviderTemplates falls back to local defaults on empty result', async () => {
    const store = useModelsStore()
    api.models.getTemplates.mockResolvedValue({ success: true, data: [] })
    await store.fetchProviderTemplates()
    expect(store.providerTemplates.length).toBe(Object.keys(PROVIDER_DEFAULTS).length)
  })

  it('fetchProviderTemplates falls back to local defaults on failure', async () => {
    const store = useModelsStore()
    api.models.getTemplates.mockRejectedValue(new Error('boom'))
    await store.fetchProviderTemplates()
    expect(store.providerTemplates.length).toBeGreaterThan(0)
  })

  it('getProvider returns data on success', async () => {
    const store = useModelsStore()
    const p = makeProvider()
    api.models.get.mockResolvedValue({ success: true, data: p })
    const got = await store.getProvider('p1')
    expect(api.models.get).toHaveBeenCalledWith('p1')
    expect(got).toEqual(p)
  })

  it('getProvider returns null on failure', async () => {
    const store = useModelsStore()
    api.models.get.mockResolvedValue({ success: false })
    const got = await store.getProvider('missing')
    expect(got).toBeNull()
  })

  it('addProvider pushes new provider on success', async () => {
    const store = useModelsStore()
    const p = makeProvider()
    api.models.add.mockResolvedValue({ success: true, data: p })
    const form: ProviderFormData = {
      name: 'OpenAI',
      type: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      organization: '',
      deploymentName: '',
      apiVersion: '',
      timeout: 60000,
      maxRetries: 3,
    }
    const got = await store.addProvider(form)
    expect(api.models.add).toHaveBeenCalledTimes(1)
    expect(got).toEqual(p)
    expect(store.providers).toContainEqual(p)
  })

  it('addProvider returns null on failure', async () => {
    const store = useModelsStore()
    api.models.add.mockResolvedValue({ success: false })
    const got = await store.addProvider({
      name: 'x',
      type: 'openai',
      enabled: true,
      baseUrl: '',
      apiKey: '',
      organization: '',
      deploymentName: '',
      apiVersion: '',
      timeout: 60000,
      maxRetries: 3,
    })
    expect(got).toBeNull()
    expect(store.providers.length).toBe(0)
  })

  it('updateProvider replaces existing entry', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider({ name: 'old' })]
    const updated = makeProvider({ name: 'new' })
    api.models.update.mockResolvedValue({ success: true, data: updated })
    const got = await store.updateProvider('p1', { name: 'new' })
    expect(api.models.update).toHaveBeenCalledWith('p1', { name: 'new' })
    expect(got).toEqual(updated)
    expect(store.providers[0].name).toBe('new')
  })

  it('updateProvider returns null on failure', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider()]
    api.models.update.mockResolvedValue({ success: false })
    const got = await store.updateProvider('p1', { name: 'x' })
    expect(got).toBeNull()
  })

  it('deleteProvider removes provider on success', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider(), makeProvider({ id: 'p2' })]
    api.models.delete.mockResolvedValue({ success: true })
    const ok = await store.deleteProvider('p1')
    expect(ok).toBe(true)
    expect(store.providers.map(p => p.id)).toEqual(['p2'])
  })

  it('deleteProvider returns false on failure', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider()]
    api.models.delete.mockResolvedValue({ success: false })
    const ok = await store.deleteProvider('p1')
    expect(ok).toBe(false)
    expect(store.providers.length).toBe(1)
  })

  it('toggleProvider flips enabled flag locally', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider({ enabled: true })]
    api.models.toggle.mockResolvedValue({ success: true })
    const ok = await store.toggleProvider('p1', false)
    expect(api.models.toggle).toHaveBeenCalledWith('p1', false)
    expect(ok).toBe(true)
    expect(store.providers[0].enabled).toBe(false)
    expect(store.enabledProviders.length).toBe(0)
    expect(store.disabledProviders.length).toBe(1)
  })

  it('toggleProvider returns false on failure', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider()]
    api.models.toggle.mockResolvedValue({ success: false })
    const ok = await store.toggleProvider('p1', false)
    expect(ok).toBe(false)
    expect(store.providers[0].enabled).toBe(true)
  })

  it('testProvider tracks testing state and returns result', async () => {
    const store = useModelsStore()
    const r: ModelTestResult = { success: true, latency: 123, response: 'ok' }
    api.models.test.mockResolvedValue({ success: true, data: r })
    expect(store.isTesting('p1')).toBe(false)
    const promise = store.testProvider('p1', 'gpt-4')
    expect(store.isTesting('p1')).toBe(true)
    const got = await promise
    expect(got).toEqual(r)
    expect(store.isTesting('p1')).toBe(false)
  })

  it('testProvider returns null on failure and clears testing state', async () => {
    const store = useModelsStore()
    api.models.test.mockResolvedValue({ success: false })
    const got = await store.testProvider('p1')
    expect(got).toBeNull()
    expect(store.isTesting('p1')).toBe(false)
  })

  it('testProvider catches thrown error', async () => {
    const store = useModelsStore()
    api.models.test.mockRejectedValue(new Error('test fail'))
    const got = await store.testProvider('p1')
    expect(got).toBeNull()
    expect(store.isTesting('p1')).toBe(false)
  })

  it('syncOllamaModels tracks syncing state and refetches', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider()]
    api.models.syncOllama.mockResolvedValue({ success: true })
    api.models.list.mockResolvedValue({ success: true, data: [makeProvider({ name: 'refreshed' })] })
    expect(store.isSyncing('p1')).toBe(false)
    const promise = store.syncOllamaModels('p1')
    expect(store.isSyncing('p1')).toBe(true)
    const ok = await promise
    expect(ok).toBe(true)
    expect(store.isSyncing('p1')).toBe(false)
    expect(api.models.syncOllama).toHaveBeenCalledWith('p1')
    expect(api.models.list).toHaveBeenCalled()
    expect(store.providers[0].name).toBe('refreshed')
  })

  it('syncOllamaModels returns false on failure', async () => {
    const store = useModelsStore()
    api.models.syncOllama.mockResolvedValue({ success: false })
    const ok = await store.syncOllamaModels('p1')
    expect(ok).toBe(false)
    expect(store.isSyncing('p1')).toBe(false)
  })

  it('fetchModels tracks fetching state and returns models', async () => {
    const store = useModelsStore()
    const models: ModelInfo[] = [
      { id: 'gpt-4', name: 'GPT-4', provider: 'p1', capabilities: ['chat'] },
    ]
    api.models.fetch.mockResolvedValue({ success: true, data: models })
    api.models.list.mockResolvedValue({ success: true, data: [makeProvider()] })
    expect(store.isFetching('p1')).toBe(false)
    const promise = store.fetchModels('p1')
    expect(store.isFetching('p1')).toBe(true)
    const got = await promise
    expect(got).toEqual({ success: true, models })
    expect(store.isFetching('p1')).toBe(false)
  })

  it('fetchModels returns error payload on failure', async () => {
    const store = useModelsStore()
    api.models.fetch.mockResolvedValue({ success: false, error: 'network' })
    const got = await store.fetchModels('p1')
    expect(got.success).toBe(false)
    expect(got.models).toEqual([])
    expect(got.error).toBe('network')
    expect(store.isFetching('p1')).toBe(false)
  })

  it('getProviderById finds provider by id', () => {
    const store = useModelsStore()
    const p1 = makeProvider()
    store.providers = [p1, makeProvider({ id: 'p2' })]
    expect(store.getProviderById('p1')?.id).toBe('p1')
    expect(store.getProviderById('p2')?.id).toBe('p2')
    expect(store.getProviderById('missing')).toBeUndefined()
  })

  it('addModelToProvider rejects duplicate model id', async () => {
    const store = useModelsStore()
    const p = makeProvider()
    store.providers = [p]
    const ok = await store.addModelToProvider('p1', 'gpt-4')
    expect(ok).toBe(false)
    expect(api.models.update).not.toHaveBeenCalled()
  })

  it('addModelToProvider rejects unknown provider', async () => {
    const store = useModelsStore()
    const ok = await store.addModelToProvider('missing', 'new-model')
    expect(ok).toBe(false)
    expect(api.models.update).not.toHaveBeenCalled()
  })

  it('addModelToProvider appends model then refetches', async () => {
    const store = useModelsStore()
    store.providers = [makeProvider()]
    const updated = makeProvider({
      models: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'p1', capabilities: ['chat'] },
        { id: 'gpt-3.5', name: 'GPT-3.5', provider: 'p1', capabilities: ['chat'] },
      ],
    })
    api.models.update.mockResolvedValue({ success: true, data: updated })
    api.models.list.mockResolvedValue({ success: true, data: [updated] })
    const ok = await store.addModelToProvider('p1', 'gpt-3.5', 'GPT-3.5', ['chat'])
    expect(api.models.update).toHaveBeenCalled()
    expect(api.models.list).toHaveBeenCalled()
    expect(ok).toBe(true)
  })

  it('PROVIDER_DEFAULTS exposes known provider types', () => {
    expect(PROVIDER_DEFAULTS.openai.baseUrl).toBe('https://api.openai.com/v1')
    expect(PROVIDER_DEFAULTS.anthropic.name).toBe('Anthropic')
    expect(PROVIDER_DEFAULTS.ollama.baseUrl).toBe('http://localhost:11434')
    expect(PROVIDER_DEFAULTS.openrouter.baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(PROVIDER_DEFAULTS.volc_ark.baseUrlMapping).toBeDefined()
  })

  it('enabledProviders / disabledProviders getter partitions correctly', () => {
    const store = useModelsStore()
    store.providers = [
      makeProvider({ id: 'a', enabled: true }),
      makeProvider({ id: 'b', enabled: false }),
      makeProvider({ id: 'c', enabled: true }),
    ]
    expect(store.enabledProviders.map(p => p.id)).toEqual(['a', 'c'])
    expect(store.disabledProviders.map(p => p.id)).toEqual(['b'])
    expect(store.enabledCount).toBe(2)
    expect(store.totalCount).toBe(3)
  })
})