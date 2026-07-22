import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import LlmConfig from '../../../src/views/LlmConfig.vue'

const { electronAPI } = vi.hoisted(() => {
  const api: any = {
    llmConfig: {
      list: vi.fn(),
      upsert: vi.fn(),
      test: vi.fn(),
    },
  }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { electronAPI: api }
})

// Stub 掉所有 element-plus 组件以避免复杂依赖
const elementPlusStubs = {
  'el-alert': { template: '<div class="el-alert-stub">{{ title }}</div>', props: ['title', 'type', 'description'] },
  'el-card': { template: '<div class="el-card-stub"><slot /><slot name="header" /><slot name="footer" /></div>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div class="el-form-item-stub"><slot /></div>' },
  'el-input': { template: '<input class="el-input-stub" />' },
  'el-select': { template: '<select class="el-select-stub"><slot /></select>' },
  'el-option': { template: '<option class="el-option-stub"><slot /></option>' },
  'el-switch': { template: '<button class="el-switch-stub" role="switch"></button>' },
  'el-button': { template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>' },
  'el-text': { template: '<span class="el-text-stub"><slot /></span>' },
  'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
}

describe('LlmConfig.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electronAPI.llmConfig.list.mockResolvedValue({ success: true, data: [] })
    electronAPI.llmConfig.upsert.mockResolvedValue({ success: true })
    electronAPI.llmConfig.test.mockResolvedValue({ success: true, data: { ok: true, model: 'gpt-4o', durationMs: 123, content: 'pong' } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mountComponent() {
    return mount(LlmConfig, {
      global: { stubs: elementPlusStubs },
      attachTo: document.body,
    })
  }

  it('mounts without throwing', () => {
    const wrapper = mountComponent()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.llm-config-page').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders three provider cards on mount', async () => {
    const wrapper = mountComponent()
    await nextTick()
    await flushPromises()
    const cards = wrapper.findAll('.provider-card')
    expect(cards.length).toBe(3)
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('Anthropic Claude')
    expect(wrapper.text()).toContain('智谱 GLM')
    wrapper.unmount()
  })

  it('calls electronAPI.llmConfig.list on mount', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(electronAPI.llmConfig.list).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('hydrates provider configs from list response', async () => {
    electronAPI.llmConfig.list.mockResolvedValueOnce({
      success: true,
      data: [
        { provider: 'openai', apiKey: 'sk-loaded', enabled: true, defaultModel: 'gpt-4o', apiBaseUrl: '', updatedAt: 1 },
      ],
    })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    // openai 是 providers[0]
    const cards = wrapper.findAll('.provider-card')
    expect(cards.length).toBe(3)
    // 通过 wrapper.vm 访问组件内 reactive 状态验证 hydration
    const vm: any = wrapper.vm
    expect(vm.providers[0].config.apiKey).toBe('sk-loaded')
    expect(vm.providers[0].config.enabled).toBe(true)
    expect(vm.providers[0].config.defaultModel).toBe('gpt-4o')
    wrapper.unmount()
  })

  it('save() invokes electronAPI.llmConfig.upsert with correct payload', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    // 触发保存
    await vm.save(vm.providers[0], true)
    expect(electronAPI.llmConfig.upsert).toHaveBeenCalledTimes(1)
    expect(electronAPI.llmConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai',
      apiKey: '',
      enabled: false,
      defaultModel: expect.any(String),
      apiBaseUrl: '',
    }))
    // 应设置 status 为成功
    expect(vm.status?.success).toBe(true)
    wrapper.unmount()
  })

  it('testConnection() invokes test API and records testResult', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.testConnection(vm.providers[0])
    expect(electronAPI.llmConfig.upsert).toHaveBeenCalled()
    expect(electronAPI.llmConfig.test).toHaveBeenCalledWith({ provider: 'openai', prompt: 'ping' })
    expect(vm.providers[0].testResult).toBeDefined()
    expect(vm.providers[0].testResult.ok).toBe(true)
    expect(vm.providers[0].testResult.summary).toContain('gpt-4o')
    wrapper.unmount()
  })

  it('testConnection() records error result when test fails', async () => {
    electronAPI.llmConfig.test.mockResolvedValueOnce({ success: false, data: { ok: false, error: 'invalid key' } })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.testConnection(vm.providers[0])
    expect(vm.providers[0].testResult).toBeDefined()
    expect(vm.providers[0].testResult.ok).toBe(false)
    expect(vm.providers[0].testResult.error).toContain('invalid key')
    wrapper.unmount()
  })

  it('renders provider rows with correct labels and icons', async () => {
    const wrapper = mountComponent()
    await nextTick()
    const providerNames = wrapper.findAll('.provider-name')
    expect(providerNames.length).toBe(3)
    expect(providerNames[0].text()).toContain('OpenAI')
    expect(providerNames[1].text()).toContain('Anthropic Claude')
    expect(providerNames[2].text()).toContain('智谱 GLM')
    wrapper.unmount()
  })

  it('renders tips section', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.find('.tips').exists()).toBe(true)
    expect(wrapper.text()).toContain('使用提示')
    wrapper.unmount()
  })
})
