import { vi } from 'vitest'

/**
 * 共享 mock electronAPI
 *
 * 覆盖 5 个目标 Pinia store 用到的所有 IPC namespace:
 * - models, chat, permissions, schedule, gateway
 *
 * 用法:
 *   import { createElectronApiMock, installElectronApiMock } from './__mocks__/electronApi'
 *   const api = createElectronApiMock()
 *   installElectronApiMock(api)
 */

export interface ElectronApiMock {
  models: Record<string, any>
  chat: Record<string, any>
  permissions: Record<string, any>
  schedule: Record<string, any>
  gateway: Record<string, any>
  [key: string]: any
}

export function createElectronApiMock(): ElectronApiMock {
  const api: ElectronApiMock = {
    models: {
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
    },
    chat: {
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
    },
    permissions: {
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
    },
    schedule: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      toggle: vi.fn(),
      history: vi.fn(),
      execute: vi.fn(),
      cancel: vi.fn(),
    },
    gateway: {
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
    },
  }
  return api
}

/**
 * 将 mock electronAPI 挂到 window 上。
 * chat store 在模块顶层就读取 window.electronAPI,所以必须在 import store 之前调用。
 */
export function installElectronApiMock(api: ElectronApiMock): void {
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
}

/**
 * 完整 setup:返回一个新建的 mock,自动安装到 window,并返回它。
 * 通常在 beforeEach 中调用。
 */
export function setupElectronApiMock(): ElectronApiMock {
  const api = createElectronApiMock()
  installElectronApiMock(api)
  return api
}