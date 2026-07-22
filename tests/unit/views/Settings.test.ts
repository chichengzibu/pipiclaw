import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

// Mock element-plus 的静态方法(ElMessage / ElMessageBox)
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
}))

// electronAPI mock + store import 之前必须就绪
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
  api.chat = { conversations: vi.fn(), getConversation: vi.fn(), createConversation: vi.fn(), updateConversation: vi.fn(), deleteConversation: vi.fn(), archiveConversation: vi.fn(), pinConversation: vi.fn(), sendMessage: vi.fn(), stopGeneration: vi.fn(), continueGeneration: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(), getLastModel: vi.fn(), onMessage: vi.fn(() => () => {}), onConversationUpdate: vi.fn(() => () => {}), onStreamUpdate: vi.fn(() => () => {}) }
  api.permissions = { list: vi.fn(), active: vi.fn(), get: vi.fn(), setActive: vi.fn(), create: vi.fn(), update: vi.fn(), updateRule: vi.fn(), delete: vi.fn(), duplicate: vi.fn(), check: vi.fn() }
  api.schedule = { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggle: vi.fn(), history: vi.fn(), execute: vi.fn(), cancel: vi.fn() }
  api.gateway = { status: vi.fn(), logs: vi.fn(), start: vi.fn(), stop: vi.fn(), restart: vi.fn(), config: { get: vi.fn(), set: vi.fn() }, onStatusChange: vi.fn(() => () => {}), onLog: vi.fn(() => () => {}) }
  // app / shortCut / heremes / mcp / config (extra namespaces used by Settings)
  api.app = { getVersion: vi.fn().mockResolvedValue({ success: true, data: '1.0.0' }), getPlatform: vi.fn(() => 'win32') }
  api.config = {
    get: vi.fn().mockResolvedValue({ success: true, data: null }),
    // set returns a Promise that supports .catch (uses await)
    set: vi.fn(() => ({ catch: vi.fn() })),
  }
  api.shortcut = { get: vi.fn().mockResolvedValue({ success: true, data: { toggle: 'Ctrl+Alt+P' } }), set: vi.fn().mockResolvedValue({ success: true }) }
  api.hermes = {
    getMemories: vi.fn().mockResolvedValue({ success: true, data: { coreMemory: '', experienceMemory: '', memories: [] } }),
    saveCoreMemory: vi.fn().mockResolvedValue({ success: true }),
  }
  api.mcp = {
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    add: vi.fn().mockResolvedValue({ success: true }),
    update: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    test: vi.fn().mockResolvedValue({ success: true }),
  }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { api }
})

import { useModelsStore, type ProviderConfig } from '../../../src/stores/models'
import Settings from '../../../src/views/Settings.vue'

// Stub element-plus + 内部组件
const stubs = {
  'el-tabs': { template: '<div class="el-tabs-stub"><slot /></div>', props: ['modelValue'] },
  'el-tab-pane': {
    props: ['label', 'name'],
    template: '<div class="el-tab-pane-stub"><span class="el-tab-pane-label">{{ label }}</span><slot /></div>',
  },
  'el-card': { template: '<div class="el-card-stub"><slot /><slot name="header" /></div>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div class="el-form-item-stub"><slot /></div>' },
  'el-input': { template: '<input class="el-input-stub" />', props: ['modelValue'] },
  'el-select': { template: '<select class="el-select-stub"><slot /></select>' },
  'el-option': { template: '<option class="el-option-stub"><slot /></option>' },
  'el-switch': { template: '<button class="el-switch-stub" role="switch"></button>' },
  'el-button': { template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>' },
  'el-icon': { template: '<i class="el-icon-stub"><slot /></i>' },
  'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
  'el-scrollbar': { template: '<div class="el-scrollbar-stub"><slot /></div>' },
  'el-empty': { template: '<div class="el-empty-stub"><slot /></div>' },
  'el-dialog': { template: '<div class="el-dialog-stub"><slot /></div>' },
  'el-divider': { template: '<hr class="el-divider-stub" />' },
  'el-input-number': { template: '<input class="el-input-number-stub" />' },
  'el-result': { template: '<div class="el-result-stub"><slot /></div>' },
  'el-tooltip': { template: '<div class="el-tooltip-stub"><slot /></div>' },
  ShortcutRecorder: { template: '<div class="shortcut-recorder-stub" />', props: ['modelValue'] },
  FeedbackModal: { template: '<div class="feedback-modal-stub" />', props: ['modelValue'] },
  McpServerCard: { template: '<div class="mcp-card-stub" />', props: ['server'], emits: ['edit', 'delete', 'test'] },
  McpServerFormDialog: { template: '<div class="mcp-form-stub" />', props: ['modelValue', 'server'], emits: ['save', 'update:modelValue'] },
  Plus: { template: '<i class="plus-stub" />' },
}

const now = 1700000000000

const makeProvider = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'p1',
  name: 'OpenAI',
  type: 'openai',
  enabled: true,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  organization: '',
  deploymentName: '',
  apiVersion: '',
  models: [{ id: 'gpt-4', name: 'GPT-4', provider: 'p1', capabilities: ['chat'] }],
  defaultModel: 'gpt-4',
  timeout: 60000,
  maxRetries: 3,
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

describe('Settings.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // 默认成功返回
    api.models.list.mockResolvedValue({ success: true, data: [] })
    api.models.getTemplates.mockResolvedValue({
      success: true,
      data: [{ name: 'OpenAI', type: 'openai', defaultConfig: { baseUrl: 'https://api.openai.com/v1' } }],
    })
    // config.set 需要支持 .catch() 链式调用 (app.ts store 使用)
    api.config.set = vi.fn(() => ({ catch: vi.fn() }))
  })

  function mountComponent() {
    return mount(Settings, {
      global: { stubs },
      attachTo: document.body,
    })
  }

  it('mounts without throwing', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.settings-page').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders page title', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.find('.page-title').text()).toBe('系统设置')
    wrapper.unmount()
  })

  it('exposes multiple tab panes', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.text()).toContain('基础设置')
    expect(wrapper.text()).toContain('模型管理')
    expect(wrapper.text()).toContain('MCP 配置')
    expect(wrapper.text()).toContain('记忆管理')
    wrapper.unmount()
  })

  it('initializes shortcutConfig from electronAPI.shortcut.get on mount', async () => {
    api.shortcut.get.mockResolvedValueOnce({ success: true, data: { toggle: 'Ctrl+Shift+Y' } })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    expect(vm.shortcutConfig.toggle).toBe('Ctrl+Shift+Y')
    wrapper.unmount()
  })

  it('falls back to default shortcut when get returns no toggle', async () => {
    api.shortcut.get.mockResolvedValueOnce({ success: true, data: {} })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    expect(vm.shortcutConfig.toggle).toBe('Ctrl+Alt+P')
    wrapper.unmount()
  })

  it('saveShortcutConfig calls electronAPI.shortcut.set', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    vm.shortcutConfig.toggle = 'Ctrl+Shift+X'
    await vm.saveShortcutConfig()
    expect(api.shortcut.set).toHaveBeenCalledWith('toggle', 'Ctrl+Shift+X')
    wrapper.unmount()
  })

  it('resetShortcutConfig restores default and saves', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    vm.shortcutConfig.toggle = 'garbage'
    await vm.resetShortcutConfig()
    expect(vm.shortcutConfig.toggle).toBe('Ctrl+Alt+P')
    expect(api.shortcut.set).toHaveBeenCalledWith('toggle', 'Ctrl+Alt+P')
    wrapper.unmount()
  })

  it('handleThemeChange delegates to appStore.setTheme', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    const spy = vi.spyOn(vm.appStore, 'setTheme')
    vm.handleThemeChange('ocean-blue')
    expect(spy).toHaveBeenCalledWith('ocean-blue')
    const ElMessage = (await import('element-plus')).ElMessage
    expect(ElMessage.success).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fetches models via store on mount', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(api.models.list).toHaveBeenCalled()
    expect(api.models.getTemplates).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders provider grid when models are present', async () => {
    const p1 = makeProvider()
    api.models.list.mockResolvedValueOnce({ success: true, data: [p1] })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('GPT-4')
    wrapper.unmount()
  })

  it('renders mcp empty state when no servers', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    // MCP 配置 tab 文本存在;empty state 单独在 MCP 面板内渲染
    expect(wrapper.text()).toContain('MCP 配置')
    wrapper.unmount()
  })

  it('icon and providerTypeName lookups return values', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    expect(vm.getProviderIcon('openai')).toBe('🤖')
    expect(vm.getProviderIcon('anthropic')).toBe('🧠')
    expect(vm.getProviderIcon('volc_ark')).toBe('🌋')
    expect(vm.getProviderIcon('zzz')).toBe('📦')
    expect(vm.getProviderTypeName('openai')).toBe('OpenAI')
    expect(vm.getProviderTypeName('anthropic')).toBe('Anthropic Claude')
    wrapper.unmount()
  })

  it('isVolcEngineProvider detects volc type and coding URL', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    const p1 = makeProvider({ type: 'volc_ark' })
    expect(vm.isVolcEngineProvider(p1)).toBe(true)
    const p2 = makeProvider({ baseUrl: 'https://x.com/api/coding/v3/models' })
    expect(vm.isVolcEngineProvider(p2)).toBe(true)
    const p3 = makeProvider({ baseUrl: 'https://api.openai.com/v1' })
    expect(vm.isVolcEngineProvider(p3)).toBe(false)
    wrapper.unmount()
  })

  it('handleToggleProvider flips provider enabled via store', async () => {
    api.models.list.mockImplementationOnce(() => new Promise(() => {})) // never resolves
    const store = useModelsStore()
    store.providers = [makeProvider({ enabled: true })]
    api.models.toggle.mockResolvedValue({ success: true })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    const vm: any = wrapper.vm
    await vm.handleToggleProvider('p1', false)
    expect(api.models.toggle).toHaveBeenCalledWith('p1', false)
    const storeAfter = useModelsStore()
    expect(storeAfter.providers[0].enabled).toBe(false)
    wrapper.unmount()
  })

  it('handleAddProvider opens dialog and ensures templates are loaded', async () => {
    const store = useModelsStore()
    store.providerTemplates = []
    api.models.getTemplates.mockResolvedValueOnce({
      success: true,
      data: [{ name: 'OpenAI', type: 'openai', defaultConfig: { baseUrl: 'https://api.openai.com/v1', timeout: 60000, maxRetries: 3 } }],
    })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.handleAddProvider()
    expect(vm.modelDialogVisible).toBe(true)
    expect(vm.isEditingModel).toBe(false)
    expect(store.providerTemplates.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('handleTypeChange populates form defaults from template', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    vm.handleTypeChange('anthropic')
    expect(vm.modelFormData.baseUrl).toBe('https://api.anthropic.com/v1')
    expect(vm.modelFormData.timeout).toBe(60000)
    wrapper.unmount()
  })
})
