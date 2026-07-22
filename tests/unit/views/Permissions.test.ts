import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

// Mock element-plus 静态方法(ElMessage / ElMessageBox)
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn().mockResolvedValue('confirm'),
  },
}))

// electronAPI mock + store import 必须在 pinia setup 之前
const { api } = vi.hoisted(() => {
  const api: any = {}
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
  api.models = { list: vi.fn(), get: vi.fn(), getTemplates: vi.fn(), add: vi.fn(), update: vi.fn(), delete: vi.fn(), toggle: vi.fn(), test: vi.fn(), syncOllama: vi.fn(), fetch: vi.fn() }
  api.chat = { conversations: vi.fn(), getConversation: vi.fn(), createConversation: vi.fn(), updateConversation: vi.fn(), deleteConversation: vi.fn(), archiveConversation: vi.fn(), pinConversation: vi.fn(), sendMessage: vi.fn(), stopGeneration: vi.fn(), continueGeneration: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(), getLastModel: vi.fn(), onMessage: vi.fn(() => () => {}), onConversationUpdate: vi.fn(() => () => {}), onStreamUpdate: vi.fn(() => () => {}) }
  api.schedule = { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggle: vi.fn(), history: vi.fn(), execute: vi.fn(), cancel: vi.fn() }
  api.gateway = { status: vi.fn(), logs: vi.fn(), start: vi.fn(), stop: vi.fn(), restart: vi.fn(), config: { get: vi.fn(), set: vi.fn() }, onStatusChange: vi.fn(() => () => {}), onLog: vi.fn(() => () => {}) }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { api }
})

import { type PermissionSet, type PermissionRule } from '../../../src/stores/permissions'
import Permissions from '../../../src/views/Permissions.vue'

// Stub element-plus 组件 + 内部组件
const stubs = {
  'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
  'el-button': { template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>' },
  'el-icon': { template: '<i class="el-icon-stub"><slot /></i>' },
  'el-scrollbar': { template: '<div class="el-scrollbar-stub"><slot /></div>' },
  'el-divider': { template: '<hr class="el-divider-stub" />' },
  'el-tooltip': { template: '<div class="el-tooltip-stub"><slot /></div>' },
  'el-select': { template: '<select class="el-select-stub"><slot /></select>' },
  'el-option': { template: '<option class="el-option-stub"><slot /></option>' },
  'el-empty': { template: '<div class="el-empty-stub"><slot /></div>' },
  'el-dialog': { template: '<div class="el-dialog-stub"><slot /></div>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div class="el-form-item-stub"><slot /></div>' },
  'el-input': { template: '<input class="el-input-stub" />' },
  Breadcrumb: { template: '<div class="breadcrumb-stub" />' },
  Plus: { template: '<i class="plus-stub" />' },
  InfoFilled: { template: '<i class="info-stub" />' },
}

const now = 1700000000000

const makeRule = (overrides: Partial<PermissionRule> = {}): PermissionRule => ({
  id: 'rule-1',
  category: 'filesystem',
  name: '读取工作目录',
  description: '可读工作目录',
  level: 'read',
  allowedPaths: ['/work'],
  deniedPaths: [],
  ...overrides,
})

const makePresetSet = (): PermissionSet => ({
  id: 'set-safe',
  name: '安全模式',
  template: 'safe',
  description: '最小权限',
  rules: [makeRule()],
  createdAt: now,
  updatedAt: now,
})

const makeCustomSet = (): PermissionSet => ({
  id: 'set-custom',
  name: '我的自定义',
  template: 'custom',
  description: '测试自定义',
  rules: [{ ...makeRule(), id: 'rule-2', allowedPaths: ['/home/x'], deniedPaths: ['/etc'] }],
  createdAt: now,
  updatedAt: now,
})

describe('Permissions.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  function mountComponent() {
    return mount(Permissions, {
      global: { stubs },
      attachTo: document.body,
    })
  }

  it('mounts without throwing', async () => {
    api.permissions.list.mockResolvedValue({ success: true, data: [] })
    api.permissions.active.mockResolvedValue({ success: false })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.permissions-page').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders page title and empty state', async () => {
    api.permissions.list.mockResolvedValue({ success: true, data: [] })
    api.permissions.active.mockResolvedValue({ success: false })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.find('.page-title').text()).toBe('权限管理')
    expect(wrapper.find('.detail-empty').exists()).toBe(true)
    wrapper.unmount()
  })

  it('fetches permission sets on mount and renders them', async () => {
    const set1 = makePresetSet()
    const set2 = makeCustomSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1, set2] })
    api.permissions.active.mockResolvedValue({ success: true, data: { id: 'set-safe' } })

    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()

    expect(api.permissions.list).toHaveBeenCalledTimes(1)
    expect(api.permissions.active).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.set-item').length).toBe(2)
    expect(wrapper.text()).toContain('安全模式')
    expect(wrapper.text()).toContain('我的自定义')
    wrapper.unmount()
  })

  it('selects active set on mount when activeSet exists', async () => {
    const set1 = makePresetSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1] })
    api.permissions.active.mockResolvedValue({ success: true, data: { id: 'set-safe' } })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    const vm: any = wrapper.vm
    expect(vm.selectedSet).toBeTruthy()
    expect(vm.selectedSet.id).toBe('set-safe')
    wrapper.unmount()
  })

  it('clicking set item triggers handleSelectSet', async () => {
    const set1 = makePresetSet()
    const set2 = makeCustomSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1, set2] })
    api.permissions.active.mockResolvedValue({ success: false })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    const items = wrapper.findAll('.set-item')
    expect(items.length).toBe(2)
    await items[1].trigger('click')
    await nextTick()
    const vm: any = wrapper.vm
    expect(vm.selectedSet.id).toBe('set-custom')
    wrapper.unmount()
  })

  it('calls permissionsStore.setActiveSet on activate click', async () => {
    const set1 = makePresetSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1] })
    api.permissions.active.mockResolvedValue({ success: false })
    api.permissions.setActive.mockResolvedValue({ success: true })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()

    const vm: any = wrapper.vm
    vm.selectedSet = set1
    await vm.handleActivate()

    expect(api.permissions.setActive).toHaveBeenCalledWith('set-safe')
    const ElMessage = (await import('element-plus')).ElMessage
    expect(ElMessage.success).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('handleCreateSet opens dialog and resets form', async () => {
    api.permissions.list.mockResolvedValue({ success: true, data: [] })
    api.permissions.active.mockResolvedValue({ success: false })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    vm.createForm.name = 'stale'
    vm.handleCreateSet()
    expect(vm.createDialogVisible).toBe(true)
    expect(vm.createForm.name).toBe('')
    expect(vm.createForm.template).toBe('standard')
    wrapper.unmount()
  })

  it('handleLevelChange delegates to updatePermissionRule', async () => {
    const set1 = makeCustomSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1] })
    api.permissions.active.mockResolvedValue({ success: true, data: { id: 'set-custom' } })
    api.permissions.updateRule.mockResolvedValue({ success: true, data: { ...set1.rules[0], level: 'write' } })

    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()

    const vm: any = wrapper.vm
    vm.selectedSet = set1
    await vm.handleLevelChange('rule-2', 'write')

    expect(api.permissions.updateRule).toHaveBeenCalledWith('set-custom', 'rule-2', { level: 'write' })
    wrapper.unmount()
  })

  it('handleDuplicate opens duplicate dialog with prefilled name', async () => {
    const set1 = makePresetSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1] })
    api.permissions.active.mockResolvedValue({ success: true, data: { id: 'set-safe' } })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()

    const vm: any = wrapper.vm
    vm.selectedSet = set1
    vm.handleDuplicate()
    expect(vm.duplicateDialogVisible).toBe(true)
    expect(vm.duplicateName).toBe('安全模式 (副本)')
    wrapper.unmount()
  })

  it('handleDelete uses ElMessageBox.confirm and deletes when confirmed', async () => {
    const set1 = makeCustomSet()
    api.permissions.list.mockResolvedValue({ success: true, data: [set1] })
    api.permissions.active.mockResolvedValue({ success: true, data: { id: 'set-custom' } })
    api.permissions.delete.mockResolvedValue({ success: true })
    const ElMessageBox = (await import('element-plus')).ElMessageBox

    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()

    const vm: any = wrapper.vm
    vm.selectedSet = set1
    await vm.handleDelete()

    expect(ElMessageBox.confirm).toHaveBeenCalled()
    expect(api.permissions.delete).toHaveBeenCalledWith('set-custom')
    wrapper.unmount()
  })

  it('icon and template lookup helpers return correct values', async () => {
    api.permissions.list.mockResolvedValue({ success: true, data: [] })
    api.permissions.active.mockResolvedValue({ success: false })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    expect(vm.getSetIcon('safe')).toBe('🛡️')
    expect(vm.getSetIcon('custom')).toBe('✏️')
    expect(vm.getTemplateName('safe')).toBe('安全模式')
    expect(vm.getCategoryIcon('filesystem')).toBe('📁')
    expect(vm.getCategoryName('network')).toBe('网络')
    expect(vm.getSetIcon('unknown')).toBe('📋')
    wrapper.unmount()
  })
})
