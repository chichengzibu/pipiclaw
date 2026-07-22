import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.hoisted 保证在 import store 之前先注入 window.electronAPI,
// 否则 chat store 在模块顶层读取 window.electronAPI 会拿到 undefined
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
    config: {
      get: vi.fn(),
      set: vi.fn(),
    },
    onStatusChange: vi.fn(() => () => {}),
    onLog: vi.fn(() => () => {}),
  }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { api }
})

import { useGatewayStore } from '../../../src/stores/gateway'

describe('useGatewayStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with stopped state and default config', () => {
    const store = useGatewayStore()
    expect(store.status.state).toBe('stopped')
    expect(store.status.port).toBe(18789)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.config.autoStart).toBe(true)
    expect(store.config.defaultPort).toBe(18789)
    expect(store.config.logLevel).toBe('info')
    expect(store.logs).toEqual([])
    expect(store.isStopped).toBe(true)
    expect(store.isRunning).toBe(false)
    expect(store.canStart).toBe(true)
    expect(store.canStop).toBe(false)
    expect(store.stateText).toBe('已停止')
  })

  it('fetchStatus updates status from electronAPI', async () => {
    const store = useGatewayStore()
    const payload = {
      state: 'running' as const,
      port: 19999,
      pid: 1234,
      startTime: 1700000000000,
      error: null,
      version: '1.0.0',
    }
    api.gateway.status.mockResolvedValue({ success: true, data: payload })
    await store.fetchStatus()
    expect(api.gateway.status).toHaveBeenCalledTimes(1)
    expect(store.status.state).toBe('running')
    expect(store.status.port).toBe(19999)
    expect(store.isRunning).toBe(true)
    expect(store.stateText).toBe('运行中')
    expect(store.canStop).toBe(true)
    expect(store.canStart).toBe(false)
  })

  it('fetchLogs replaces the logs array on success', async () => {
    const store = useGatewayStore()
    const sample = [
      { timestamp: 1, level: 'info' as const, message: 'boot' },
      { timestamp: 2, level: 'warn' as const, message: 'slow' },
    ]
    api.gateway.logs.mockResolvedValue({ success: true, data: sample })
    await store.fetchLogs()
    expect(store.logs).toEqual(sample)
    expect(store.logs.length).toBe(2)
  })

  it('fetchConfig updates config on success', async () => {
    const store = useGatewayStore()
    api.gateway.config.get.mockResolvedValue({
      success: true,
      data: { autoStart: false, defaultPort: 20000, timeout: 10000, logLevel: 'debug', customArgs: ['--x'] },
    })
    await store.fetchConfig()
    expect(store.config.autoStart).toBe(false)
    expect(store.config.defaultPort).toBe(20000)
    expect(store.config.logLevel).toBe('debug')
    expect(store.config.customArgs).toEqual(['--x'])
  })

  it('start succeeds and clears error', async () => {
    const store = useGatewayStore()
    api.gateway.start.mockResolvedValue({ success: true })
    await store.start({ port: 19999, timeout: 5000 })
    expect(api.gateway.start).toHaveBeenCalledWith({ port: 19999, timeout: 5000 })
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('start sets error from failed electronAPI result', async () => {
    const store = useGatewayStore()
    api.gateway.start.mockResolvedValue({ success: false, error: '端口占用' })
    await store.start({ port: 1 })
    expect(store.error).toBe('端口占用')
  })

  it('stop succeeds on success', async () => {
    const store = useGatewayStore()
    api.gateway.stop.mockResolvedValue({ success: true })
    await store.stop()
    expect(api.gateway.stop).toHaveBeenCalledTimes(1)
    expect(store.error).toBeNull()
  })

  it('stop captures thrown error message', async () => {
    const store = useGatewayStore()
    api.gateway.stop.mockRejectedValue(new Error('Boom'))
    await store.stop()
    expect(store.error).toBe('Boom')
    expect(store.loading).toBe(false)
  })

  it('restart propagates failure', async () => {
    const store = useGatewayStore()
    api.gateway.restart.mockResolvedValue({ success: false, error: 'restart fail' })
    await store.restart()
    expect(store.error).toBe('restart fail')
  })

  it('addLog appends and caps at 500 entries', () => {
    const store = useGatewayStore()
    for (let i = 0; i < 510; i++) {
      store.addLog({ timestamp: i, level: 'info', message: `m${i}` })
    }
    expect(store.logs.length).toBe(500)
    expect(store.logs[0].message).toBe('m10')
    expect(store.logs[store.logs.length - 1].message).toBe('m509')
  })

  it('updateStatus replaces the status object', () => {
    const store = useGatewayStore()
    store.updateStatus({
      state: 'failed',
      port: 12345,
      pid: null,
      startTime: null,
      error: 'crash',
      version: '0.0.1',
    })
    expect(store.status.state).toBe('failed')
    expect(store.isFailed).toBe(true)
    expect(store.canStart).toBe(true)
    expect(store.stateText).toBe('启动失败')
  })

  it('updateConfig merges on success', async () => {
    const store = useGatewayStore()
    api.gateway.config.set.mockResolvedValue({ success: true })
    await store.updateConfig({ logLevel: 'debug' })
    expect(api.gateway.config.set).toHaveBeenCalledWith({ logLevel: 'debug' })
    expect(store.config.logLevel).toBe('debug')
    expect(store.config.autoStart).toBe(true)
  })

  it('updateConfig does not merge on failure', async () => {
    const store = useGatewayStore()
    api.gateway.config.set.mockResolvedValue({ success: false })
    await store.updateConfig({ logLevel: 'warn' })
    expect(store.config.logLevel).toBe('info')
  })

  it('ensureRunning returns true when already running', async () => {
    const store = useGatewayStore()
    store.updateStatus({
      state: 'running',
      port: 18789,
      pid: 1,
      startTime: Date.now(),
      error: null,
      version: '1.0.0',
    })
    const ok = await store.ensureRunning()
    expect(ok).toBe(true)
    expect(api.gateway.start).not.toHaveBeenCalled()
  })

  it('initialize registers listeners and fetches initial data', () => {
    const store = useGatewayStore()
    api.gateway.status.mockResolvedValue({ success: true, data: store.status })
    api.gateway.logs.mockResolvedValue({ success: true, data: [] })
    api.gateway.config.get.mockResolvedValue({ success: true, data: store.config })
    store.initialize()
    expect(api.gateway.status).toHaveBeenCalledTimes(1)
    expect(api.gateway.logs).toHaveBeenCalledTimes(1)
    expect(api.gateway.config.get).toHaveBeenCalledTimes(1)
    expect(api.gateway.onStatusChange).toHaveBeenCalledTimes(1)
    expect(api.gateway.onLog).toHaveBeenCalledTimes(1)
  })

  it('initialize status listener updates status on callback', () => {
    const store = useGatewayStore()
    let captured: ((data: any) => void) | null = null
    api.gateway.onStatusChange.mockImplementation((cb: any) => {
      captured = cb
      return () => {}
    })
    api.gateway.status.mockResolvedValue({ success: true, data: store.status })
    api.gateway.logs.mockResolvedValue({ success: true, data: [] })
    api.gateway.config.get.mockResolvedValue({ success: true, data: store.config })
    store.initialize()
    expect(captured).not.toBeNull()
    ;(captured as any)({ info: { state: 'starting', port: 1, pid: null, startTime: null, error: null, version: null } })
    expect(store.status.state).toBe('starting')
    expect(store.isStarting).toBe(true)
  })
})