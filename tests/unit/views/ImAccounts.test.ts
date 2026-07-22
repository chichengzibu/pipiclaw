import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImAccounts from '../../../src/views/ImAccounts.vue'

const { electronAPI } = vi.hoisted(() => {
  const api: any = {
    channelConfig: {
      get: vi.fn(),
      test: vi.fn(),
      save: vi.fn(),
    },
  }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { electronAPI: api }
})

const elementPlusStubs = {
  'el-tabs': { template: '<div class="el-tabs-stub"><slot /></div>' },
  'el-tab-pane': { template: '<div class="el-tab-pane-stub"><slot /></div>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div class="el-form-item-stub"><slot /></div>' },
  'el-input': { template: '<input class="el-input-stub" />' },
  'el-switch': { template: '<button class="el-switch-stub" role="switch"></button>' },
  'el-button': { template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>' },
  'el-alert': { template: '<div class="el-alert-stub"><slot /></div>' },
  'el-card': { template: '<div class="el-card-stub"><slot /><slot name="header" /></div>' },
}

// alert / window.alert mock
const originalAlert = window.alert
beforeAll(() => {
  window.alert = vi.fn()
})
afterAll(() => {
  window.alert = originalAlert
})

describe('ImAccounts.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electronAPI.channelConfig.get.mockResolvedValue({ success: true, data: [] })
    electronAPI.channelConfig.test.mockResolvedValue({ success: true, message: 'ok' })
    electronAPI.channelConfig.save.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mountComponent() {
    return mount(ImAccounts, {
      global: { stubs: elementPlusStubs },
      attachTo: document.body,
    })
  }

  it('mounts without throwing', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.im-accounts').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders page title and hint', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.find('h2').text()).toBe('IM 账号配置')
    expect(wrapper.text()).toContain('配置飞书 / 钉钉 / 企微 凭证')
    wrapper.unmount()
  })

  it('renders three tab panes', async () => {
    const wrapper = mountComponent()
    await nextTick()
    const panes = wrapper.findAll('.el-tab-pane-stub')
    expect(panes.length).toBeGreaterThanOrEqual(3)
    expect(wrapper.text()).toContain('飞书')
    expect(wrapper.text()).toContain('钉钉')
    expect(wrapper.text()).toContain('企微')
    wrapper.unmount()
  })

  it('calls channelConfig.get on mount', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(electronAPI.channelConfig.get).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('hydrates feishu config from channelConfig.get response', async () => {
    electronAPI.channelConfig.get.mockResolvedValueOnce({
      success: true,
      data: [
        { channelKind: 'im-feishu', appId: 'cli_xxx', appSecret: 'secret', enabled: true },
      ],
    })
    const wrapper = mountComponent()
    await flushPromises()
    await nextTick()
    const vm: any = wrapper.vm
    expect(vm.feishu.appId).toBe('cli_xxx')
    expect(vm.feishu.appSecret).toBe('secret')
    expect(vm.feishu.enabled).toBe(true)
    wrapper.unmount()
  })

  it('hydrates dingtalk config including webhookUrl', async () => {
    electronAPI.channelConfig.get.mockResolvedValueOnce({
      success: true,
      data: [
        { channelKind: 'im-dingtalk', appKey: 'dk', appSecret: 'ds', webhookUrl: 'https://hook', enabled: true },
      ],
    })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    expect(vm.dingtalk.appKey).toBe('dk')
    expect(vm.dingtalk.webhookUrl).toBe('https://hook')
    expect(vm.dingtalk.enabled).toBe(true)
    wrapper.unmount()
  })

  it('hydrates wechatwork config with corpId/agentId', async () => {
    electronAPI.channelConfig.get.mockResolvedValueOnce({
      success: true,
      data: [
        { channelKind: 'im-wechat-work', corpId: 'wwx', corpSecret: 'cs', agentId: '1000002', enabled: true },
      ],
    })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    expect(vm.wechatwork.corpId).toBe('wwx')
    expect(vm.wechatwork.corpSecret).toBe('cs')
    expect(vm.wechatwork.agentId).toBe('1000002')
    expect(vm.wechatwork.enabled).toBe(true)
    wrapper.unmount()
  })

  it('testConnection invokes channelConfig.test and sets result', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.testConnection('im-feishu', vm.feishu)
    expect(electronAPI.channelConfig.test).toHaveBeenCalledWith({
      platform: 'im-feishu',
      config: vm.feishu,
    })
    expect(vm.testResults['im-feishu']).toBeDefined()
    expect(vm.testResults['im-feishu'].ok).toBe(true)
    expect(vm.testResults['im-feishu'].message).toBe('ok')
    expect(vm.testing['im-feishu']).toBe(false)
    wrapper.unmount()
  })

  it('testConnection handles thrown error', async () => {
    electronAPI.channelConfig.test.mockRejectedValueOnce(new Error('IPC fail'))
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.testConnection('im-dingtalk', vm.dingtalk)
    expect(vm.testResults['im-dingtalk'].ok).toBe(false)
    expect(String(vm.testResults['im-dingtalk'].message)).toContain('IPC fail')
    wrapper.unmount()
  })

  it('saveAll invokes channelConfig.save for all three channels', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.saveAll()
    expect(electronAPI.channelConfig.save).toHaveBeenCalledTimes(3)
    const platforms = electronAPI.channelConfig.save.mock.calls.map((c: any[]) => c[0].platform)
    expect(platforms).toEqual(expect.arrayContaining(['im-feishu', 'im-dingtalk', 'im-wechat-work']))
    expect(vm.isSaving).toBe(false)
    wrapper.unmount()
  })

  it('saveAll surfaces error via alert when a save fails', async () => {
    electronAPI.channelConfig.save.mockResolvedValueOnce({ success: false, error: 'no' })
    electronAPI.channelConfig.save.mockResolvedValueOnce({ success: false, error: 'no' })
    electronAPI.channelConfig.save.mockResolvedValueOnce({ success: false, error: 'no' })
    const wrapper = mountComponent()
    await flushPromises()
    const vm: any = wrapper.vm
    await vm.saveAll()
    expect(vm.isSaving).toBe(false)
    wrapper.unmount()
  })

  it('renders im-flow card with instructions', async () => {
    const wrapper = mountComponent()
    await nextTick()
    expect(wrapper.find('.im-flow').exists()).toBe(true)
    expect(wrapper.text()).toContain('使用流程')
    expect(wrapper.text()).toContain('ngrok')
    wrapper.unmount()
  })
})
