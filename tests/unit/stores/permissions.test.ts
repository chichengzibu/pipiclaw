import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  usePermissionsStore,
  type PermissionSet,
  type PermissionRule,
  type PermissionCheckResult,
  PERMISSION_CATEGORIES,
  PERMISSION_LEVELS,
  TEMPLATE_NAMES,
} from '../../../src/stores/permissions'

const now = 1700000000000

const makeRule = (): PermissionRule => ({
  id: 'rule-1',
  category: 'filesystem',
  name: '读取工作目录',
  description: '可读工作目录',
  level: 'read',
  allowedPaths: ['/work'],
  deniedPaths: ['/work/.ssh'],
})

const makePreset = (): PermissionSet => ({
  id: 'set-safe',
  name: '安全模式',
  template: 'safe',
  description: '最小权限',
  rules: [makeRule()],
  createdAt: now,
  updatedAt: now,
})

const makeCustom = (): PermissionSet => ({
  id: 'set-custom',
  name: '我的自定义',
  template: 'custom',
  description: '测试自定义',
  rules: [{ ...makeRule(), id: 'rule-2' }],
  createdAt: now,
  updatedAt: now,
})

describe('usePermissionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  it('initializes with empty permission sets and no active', () => {
    const store = usePermissionsStore()
    expect(store.permissionSets).toEqual([])
    expect(store.activeSetId).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.activeSet).toBeUndefined()
    expect(store.presetSets).toEqual([])
    expect(store.customSets).toEqual([])
  })

  it('fetchPermissionSets loads list and active id', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    const custom = makeCustom()
    api.permissions.list.mockResolvedValue({ success: true, data: [preset, custom] })
    api.permissions.active.mockResolvedValue({ success: true, data: { id: 'set-safe' } })
    await store.fetchPermissionSets()
    expect(api.permissions.list).toHaveBeenCalledTimes(1)
    expect(api.permissions.active).toHaveBeenCalledTimes(1)
    expect(store.permissionSets.length).toBe(2)
    expect(store.activeSetId).toBe('set-safe')
    expect(store.activeSet?.id).toBe('set-safe')
    expect(store.loading).toBe(false)
  })

  it('fetchPermissionSets handles failure silently and clears loading', async () => {
    const store = usePermissionsStore()
    api.permissions.list.mockResolvedValue({ success: false })
    api.permissions.active.mockResolvedValue({ success: false })
    await store.fetchPermissionSets()
    expect(store.permissionSets).toEqual([])
    expect(store.activeSetId).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('fetchPermissionSets catches thrown error', async () => {
    const store = usePermissionsStore()
    api.permissions.list.mockRejectedValue(new Error('IPC down'))
    await store.fetchPermissionSets()
    expect(store.loading).toBe(false)
  })

  it('getPermissionSet returns data on success', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    api.permissions.get.mockResolvedValue({ success: true, data: preset })
    const got = await store.getPermissionSet('set-safe')
    expect(api.permissions.get).toHaveBeenCalledWith('set-safe')
    expect(got).toEqual(preset)
  })

  it('getPermissionSet returns null on failure', async () => {
    const store = usePermissionsStore()
    api.permissions.get.mockResolvedValue({ success: false })
    const got = await store.getPermissionSet('missing')
    expect(got).toBeNull()
  })

  it('setActiveSet updates activeSetId on success', async () => {
    const store = usePermissionsStore()
    api.permissions.setActive.mockResolvedValue({ success: true })
    const ok = await store.setActiveSet('set-custom')
    expect(ok).toBe(true)
    expect(api.permissions.setActive).toHaveBeenCalledWith('set-custom')
    expect(store.activeSetId).toBe('set-custom')
  })

  it('setActiveSet returns false on failure', async () => {
    const store = usePermissionsStore()
    api.permissions.setActive.mockResolvedValue({ success: false })
    const ok = await store.setActiveSet('missing')
    expect(ok).toBe(false)
    expect(store.activeSetId).toBeNull()
  })

  it('createPermissionSet pushes new set on success', async () => {
    const store = usePermissionsStore()
    const custom = makeCustom()
    api.permissions.create.mockResolvedValue({ success: true, data: custom })
    const created = await store.createPermissionSet({
      name: '我的自定义',
      template: 'custom',
      description: '测试自定义',
      rules: [],
    })
    expect(api.permissions.create).toHaveBeenCalledTimes(1)
    expect(created).toEqual(custom)
    expect(store.permissionSets).toContainEqual(custom)
    expect(store.loading).toBe(false)
  })

  it('createPermissionSet returns null on failure', async () => {
    const store = usePermissionsStore()
    api.permissions.create.mockResolvedValue({ success: false, error: 'conflict' })
    const created = await store.createPermissionSet({
      name: 'x',
      template: 'custom',
      description: 'x',
    })
    expect(created).toBeNull()
  })

  it('updatePermissionSet replaces the set in list', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    store.permissionSets = [preset]
    const updated: PermissionSet = { ...preset, name: '已更新', updatedAt: now + 1 }
    api.permissions.update.mockResolvedValue({ success: true, data: updated })
    const result = await store.updatePermissionSet('set-safe', { name: '已更新' })
    expect(api.permissions.update).toHaveBeenCalledWith('set-safe', { name: '已更新' })
    expect(result).toEqual(updated)
    expect(store.permissionSets[0].name).toBe('已更新')
  })

  it('updatePermissionSet returns null when set not found locally', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    api.permissions.update.mockResolvedValue({ success: true, data: preset })
    const result = await store.updatePermissionSet('unknown', { name: 'x' })
    expect(result).toEqual(preset)
    expect(store.permissionSets.length).toBe(0)
  })

  it('updatePermissionRule replaces the rule in place', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    store.permissionSets = [preset]
    const newRule: PermissionRule = { ...makeRule(), level: 'write' }
    api.permissions.updateRule.mockResolvedValue({ success: true, data: newRule })
    const result = await store.updatePermissionRule('set-safe', 'rule-1', { level: 'write' })
    expect(api.permissions.updateRule).toHaveBeenCalledWith('set-safe', 'rule-1', { level: 'write' })
    expect(result).toEqual(newRule)
    expect(store.permissionSets[0].rules[0].level).toBe('write')
  })

  it('updatePermissionRule returns null on failure', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    store.permissionSets = [preset]
    api.permissions.updateRule.mockResolvedValue({ success: false })
    const result = await store.updatePermissionRule('set-safe', 'rule-1', { level: 'write' })
    expect(result).toBeNull()
    expect(store.permissionSets[0].rules[0].level).toBe('read')
  })

  it('deletePermissionSet removes the set from list', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    const custom = makeCustom()
    store.permissionSets = [preset, custom]
    store.activeSetId = 'set-custom'
    api.permissions.delete.mockResolvedValue({ success: true })
    const ok = await store.deletePermissionSet('set-custom')
    expect(ok).toBe(true)
    expect(store.permissionSets).toEqual([preset])
    // activeSetId 被重定向到剩余第一个
    expect(store.activeSetId).toBe('set-safe')
  })

  it('deletePermissionSet clears active when last set removed', async () => {
    const store = usePermissionsStore()
    const custom = makeCustom()
    store.permissionSets = [custom]
    store.activeSetId = 'set-custom'
    api.permissions.delete.mockResolvedValue({ success: true })
    const ok = await store.deletePermissionSet('set-custom')
    expect(ok).toBe(true)
    expect(store.permissionSets).toEqual([])
    expect(store.activeSetId).toBeNull()
  })

  it('deletePermissionSet returns false on failure', async () => {
    const store = usePermissionsStore()
    const preset = makePreset()
    store.permissionSets = [preset]
    api.permissions.delete.mockResolvedValue({ success: false })
    const ok = await store.deletePermissionSet('set-safe')
    expect(ok).toBe(false)
    expect(store.permissionSets.length).toBe(1)
  })

  it('duplicatePermissionSet pushes cloned set', async () => {
    const store = usePermissionsStore()
    const dup: PermissionSet = { ...makePreset(), id: 'set-safe-copy', name: '安全模式 (copy)' }
    api.permissions.duplicate.mockResolvedValue({ success: true, data: dup })
    const result = await store.duplicatePermissionSet('set-safe', '安全模式 (copy)')
    expect(api.permissions.duplicate).toHaveBeenCalledWith('set-safe', '安全模式 (copy)')
    expect(result).toEqual(dup)
    expect(store.permissionSets).toContainEqual(dup)
  })

  it('duplicatePermissionSet returns null on failure', async () => {
    const store = usePermissionsStore()
    api.permissions.duplicate.mockResolvedValue({ success: false })
    const result = await store.duplicatePermissionSet('set-safe', 'x')
    expect(result).toBeNull()
  })

  it('checkPermission returns result on success', async () => {
    const store = usePermissionsStore()
    const r: PermissionCheckResult = { allowed: true, requiresConfirmation: false }
    api.permissions.check.mockResolvedValue({ success: true, data: r })
    const result = await store.checkPermission({ category: 'filesystem', action: 'read', resource: '/work/x' })
    expect(api.permissions.check).toHaveBeenCalledWith({ category: 'filesystem', action: 'read', resource: '/work/x' })
    expect(result).toEqual(r)
  })

  it('checkPermission returns null on failure', async () => {
    const store = usePermissionsStore()
    api.permissions.check.mockResolvedValue({ success: false })
    const result = await store.checkPermission({ category: 'network', action: 'connect' })
    expect(result).toBeNull()
  })

  it('presetSets and customSets split correctly', () => {
    const store = usePermissionsStore()
    store.permissionSets = [makePreset(), makeCustom()]
    expect(store.presetSets.map(s => s.id)).toEqual(['set-safe'])
    expect(store.customSets.map(s => s.id)).toEqual(['set-custom'])
  })

  it('exposes static metadata dictionaries', () => {
    expect(PERMISSION_CATEGORIES.filesystem.icon).toBe('📁')
    expect(PERMISSION_LEVELS.all.name).toBe('完全')
    expect(TEMPLATE_NAMES.safe).toBe('安全模式')
    expect(TEMPLATE_NAMES.custom).toBe('自定义')
  })
})