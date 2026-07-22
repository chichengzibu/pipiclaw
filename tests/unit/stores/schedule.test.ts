import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.hoisted 保证在 import store 之前先注入 window.electronAPI
const { api: _api } = vi.hoisted(() => {
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

import { useScheduleStore, type ScheduleTask, type TaskExecutionHistory } from '../../../src/stores/schedule'

const now = 1700000000000

const sampleTask: ScheduleTask = {
  id: 'task-1',
  name: '每天清理临时文件',
  description: '清理 /tmp 下的旧文件',
  instruction: '清理临时文件',
  scheduleType: 'cron',
  scheduleValue: '0 3 * * *',
  enabled: true,
  maxRetries: 2,
  createdAt: now,
  updatedAt: now,
}

const sampleHistory: TaskExecutionHistory = {
  id: 'exec-1',
  taskId: 'task-1',
  taskName: '每天清理临时文件',
  instruction: '清理临时文件',
  status: 'success',
  startTime: now,
  endTime: now + 1000,
  duration: 1000,
  retryCount: 0,
}

describe('useScheduleStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with empty state', () => {
    const store = useScheduleStore()
    expect(store.tasks).toEqual([])
    expect(store.history).toEqual([])
    expect(store.showCreateDialog).toBe(false)
    expect(store.editingTask).toBeNull()
  })

  it('setTasks replaces the entire tasks array', () => {
    const store = useScheduleStore()
    store.setTasks([sampleTask])
    expect(store.tasks).toEqual([sampleTask])
    expect(store.tasks.length).toBe(1)
    store.setTasks([])
    expect(store.tasks).toEqual([])
  })

  it('setHistory replaces the entire history array', () => {
    const store = useScheduleStore()
    store.setHistory([sampleHistory])
    expect(store.history).toEqual([sampleHistory])
    store.setHistory([sampleHistory, { ...sampleHistory, id: 'exec-2', status: 'failed' }])
    expect(store.history.length).toBe(2)
    expect(store.history[1].status).toBe('failed')
  })

  it('openCreateDialog opens dialog and clears editingTask', () => {
    const store = useScheduleStore()
    store.editingTask = sampleTask
    store.showCreateDialog = false
    store.openCreateDialog()
    expect(store.showCreateDialog).toBe(true)
    expect(store.editingTask).toBeNull()
  })

  it('openEditDialog sets editingTask (cloned) and opens dialog', () => {
    const store = useScheduleStore()
    store.openEditDialog(sampleTask)
    expect(store.showCreateDialog).toBe(true)
    expect(store.editingTask).toEqual(sampleTask)
    // 确保是浅拷贝:修改副本不影响 store 的引用
    expect(store.editingTask).not.toBe(sampleTask)
    store.editingTask!.name = '改名'
    expect(sampleTask.name).toBe('每天清理临时文件')
  })

  it('closeDialog hides dialog and clears editingTask', () => {
    const store = useScheduleStore()
    store.showCreateDialog = true
    store.editingTask = sampleTask
    store.closeDialog()
    expect(store.showCreateDialog).toBe(false)
    expect(store.editingTask).toBeNull()
  })

  it('retains independent state across instances in same pinia', () => {
    const store1 = useScheduleStore()
    store1.setTasks([sampleTask])
    const store2 = useScheduleStore()
    expect(store2.tasks).toEqual([sampleTask])
    // 同一个 pinia 实例,store1/store2 共享 state
    expect(store1.tasks).toBe(store2.tasks)
  })

  it('openCreateDialog after openEditDialog resets editingTask to null', () => {
    const store = useScheduleStore()
    store.openEditDialog(sampleTask)
    expect(store.editingTask).not.toBeNull()
    store.openCreateDialog()
    expect(store.editingTask).toBeNull()
    expect(store.showCreateDialog).toBe(true)
  })

  it('history can hold mixed statuses', () => {
    const store = useScheduleStore()
    const mixed = [
      { ...sampleHistory, id: 'e1', status: 'pending' as const },
      { ...sampleHistory, id: 'e2', status: 'running' as const },
      { ...sampleHistory, id: 'e3', status: 'success' as const },
      { ...sampleHistory, id: 'e4', status: 'failed' as const },
    ]
    store.setHistory(mixed)
    expect(store.history.map(h => h.status)).toEqual(['pending', 'running', 'success', 'failed'])
  })

  it('scheduleType variants are accepted by type system', () => {
    const store = useScheduleStore()
    const variants: ScheduleTask[] = [
      { ...sampleTask, id: 'once', scheduleType: 'once', scheduleValue: '2025-01-01T00:00:00Z' },
      { ...sampleTask, id: 'daily', scheduleType: 'daily', scheduleValue: '08:00' },
      { ...sampleTask, id: 'weekly', scheduleType: 'weekly', scheduleValue: '1' },
      { ...sampleTask, id: 'monthly', scheduleType: 'monthly', scheduleValue: '1' },
      { ...sampleTask, id: 'cron', scheduleType: 'cron', scheduleValue: '*/5 * * * *' },
    ]
    store.setTasks(variants)
    expect(store.tasks.length).toBe(5)
    expect(store.tasks.map(t => t.scheduleType)).toEqual(['once', 'daily', 'weekly', 'monthly', 'cron'])
  })
})