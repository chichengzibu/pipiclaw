import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') },
}))

vi.mock('@element-plus/icons-vue', () => ({
  Plus: { template: '<span>+</span>' },
}))

/**
 * P0-01: IM 管理 UI — 配置面板
 *
 * 验证 ImManagement.vue 的核心交互:
 * - 加载通道列表
 * - 卡片渲染
 * - 打开/关闭对话框
 * - 保存 / 测试 / 删除 入口
 */

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': {} },
})

const mockChannelConfigs = [
  { channelKind: 'im-feishu', appId: 'cli_xxx', enabled: true, updatedAt: Date.now() },
  { channelKind: 'im-telegram', botToken: 't_xxx', enabled: false, updatedAt: Date.now() },
]

;(globalThis as any).window = (globalThis as any).window || {}
;(window as any).electronAPI = {
  channelConfig: {
    get: vi.fn().mockResolvedValue({ success: true, data: mockChannelConfigs }),
    save: vi.fn().mockResolvedValue({ success: true }),
    test: vi.fn().mockResolvedValue({ success: true, data: { message: 'ok' } }),
  },
  channel: {
    messageStats: vi.fn().mockResolvedValue({ success: true, data: { total: 0, byChannel: {}, sinceMs: 0 } }),
    messageHistory: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}

// Element-plus 组件 stub(避免 jsdom 不全 + 加快测试)
const elementPlusStubs = {
  'el-tabs': { template: '<div class="el-tabs-stub"><slot /></div>' },
  'el-tab-pane': { template: '<div class="el-tab-pane-stub"><slot /></div>' },
  'el-button': { template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>' },
  'el-icon': { template: '<span class="el-icon-stub"><slot /></span>' },
  'el-input': { template: '<input class="el-input-stub" />' },
  'el-input-number': { template: '<input class="el-input-number-stub" type="number" />' },
  'el-select': { template: '<select class="el-select-stub"><slot /></select>' },
  'el-select-v2': { template: '<select class="el-select-stub"><slot /></select>' },
  'el-option': { template: '<option class="el-option-stub"><slot /></option>' },
  'el-option-group': { template: '<optgroup class="el-option-group-stub"><slot /></optgroup>' },
  'el-switch': { template: '<button class="el-switch-stub" @click="$emit(\'update:modelValue\', !modelValue)" role="switch" />', props: ['modelValue'] },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div class="el-form-item-stub"><slot /></div>' },
  'el-dialog': { template: '<div class="el-dialog-stub" v-if="modelValue"><slot /></div>', props: ['modelValue', 'title', 'width'] },
  'el-empty': { template: '<div class="el-empty-stub">{{ description }}</div>', props: ['description'] },
  'el-statistic': { template: '<div class="el-statistic-stub"><span class="title">{{ title }}</span> <span class="value">{{ value }}</span></div>', props: ['title', 'value'] },
  'el-table': { template: '<div class="el-table-stub"><slot /></div>' },
  'el-table-column': { template: '<div class="el-table-column-stub" />', props: ['label', 'prop', 'width'] },
  'el-pagination': { template: '<div class="el-pagination-stub" />' },
  'el-tag': { template: '<span class="el-tag-stub" :data-type="type"><slot /></span>', props: ['type', 'size'] },
}

import ImManagement from '../../../src/views/ImManagement.vue'

describe('P0-01: ImManagement 配置面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载后加载通道列表', async () => {
    const wrapper = mount(ImManagement, {
      global: { plugins: [i18n], stubs: elementPlusStubs },
    })
    await flushPromises()
    expect((window as any).electronAPI.channelConfig.get).toHaveBeenCalled()
    expect(wrapper.text()).toContain('IM 管理')
  })

  it('空状态:无通道时显示 empty', async () => {
    ;(window as any).electronAPI.channelConfig.get = vi.fn().mockResolvedValue({ success: true, data: [] })
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    expect(wrapper.html()).toContain('empty')
  })

  it('有通道时:卡片显示通道名 + 启用状态', async () => {
    ;(window as any).electronAPI.channelConfig.get = vi.fn().mockResolvedValue({ success: true, data: mockChannelConfigs })
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('飞书 / Lark')
    expect(wrapper.text()).toContain('Telegram')
  })

  it('enabledCount 计算正确', async () => {
    ;(window as any).electronAPI.channelConfig.get = vi.fn().mockResolvedValue({ success: true, data: mockChannelConfigs })
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    // mockChannelConfigs: feishu enabled, telegram disabled → 1 enabled
    expect(wrapper.text()).toContain('已启用 1')
  })

  it('加载失败时不抛错', async () => {
    ;(window as any).electronAPI.channelConfig.get = vi.fn().mockRejectedValue(new Error('IPC fail'))
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })

  it('Tab 切换:5 个 tab 名称正确', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const html = wrapper.html()
    expect(html).toContain('通道配置')
    expect(html).toContain('状态仪表板')
    expect(html).toContain('消息查看器')
    expect(html).toContain('路由规则')
    expect(html).toContain('权限管理')
  })
})

describe('P0-04: ImManagement 路由规则', () => {
  it('初始 routingRules 为空数组', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('共 0 条规则')
  })

  it('handleSaveRule: 缺触发词时 warning', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const { ElMessage } = await import('element-plus')
    const vm = wrapper.vm as any
    vm.ruleForm.trigger = ''
    vm.ruleForm.targetChannel = ''
    vm.handleSaveRule()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('handleSaveRule: 完整字段 → 规则加入列表', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = wrapper.vm as any
    vm.ruleForm.trigger = '日程|schedule'
    vm.ruleForm.targetChannel = 'im-feishu'
    vm.ruleForm.targetUserId = 'chat_001'
    vm.ruleForm.priority = 10
    vm.handleSaveRule()
    expect(vm.routingRules.length).toBe(1)
    expect(vm.routingRules[0].trigger).toBe('日程|schedule')
  })
})

describe('P0-05: ImManagement 权限', () => {
  it('handleSavePermission: 缺 subject 时 warning', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const { ElMessage } = await import('element-plus')
    const vm = wrapper.vm as any
    vm.permissionForm.subject = ''
    vm.handleSavePermission()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('handleSavePermission: 完整字段 → 权限加入', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = wrapper.vm as any
    vm.permissionForm.subject = '张三'
    vm.permissionForm.level = 'admin'
    vm.permissionForm.scope = ['im-feishu']
    vm.handleSavePermission()
    expect(vm.permissions.length).toBe(1)
    expect(vm.permissions[0].subject).toBe('张三')
  })
})

describe('P0-02/03 状态 + 消息', () => {
  it('statusSummary 计算字段(默认无 testError → online = enabled 数)', async () => {
    ;(window as any).electronAPI.channelConfig.get = vi.fn().mockResolvedValue({
      success: true,
      data: [
        { channelKind: 'im-feishu', enabled: true },
        { channelKind: 'im-telegram', enabled: true },
        { channelKind: 'im-slack', enabled: false },
      ],
    })
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = wrapper.vm as any
    // 2 enabled, 0 with testError → online 2, offline 0, disabled 1
    expect(vm.statusSummary.online).toBe(2)
    expect(vm.statusSummary.offline).toBe(0)
    expect(vm.statusSummary.disabled).toBe(1)
  })

  it('handleTestChannel 失败后 → 计入 offline', async () => {
    ;(window as any).electronAPI.channelConfig.get = vi.fn().mockResolvedValue({
      success: true,
      data: [{ channelKind: 'im-feishu', enabled: true }],
    })
    ;(window as any).electronAPI.channelConfig.test = vi.fn().mockResolvedValue({ success: false, error: 'token bad' })
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = wrapper.vm as any
    await vm.handleTestChannel(vm.channels[0])
    expect(vm.channels[0].testError).toBe('token bad')
    expect(vm.statusSummary.online).toBe(0)
    expect(vm.statusSummary.offline).toBe(1)
  })

  it('reloadMessages: 消息列表初始为空', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = wrapper.vm as any
    await vm.reloadMessages()
    expect(vm.allMessages).toEqual([])
  })

  it('filteredMessages 按 channel + keyword 过滤', async () => {
    const wrapper = mount(ImManagement, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = wrapper.vm as any
    vm.allMessages = [
      { ts: Date.now(), channelId: 'im-feishu', direction: 'in', message: { text: '你好' } },
      { ts: Date.now(), channelId: 'im-telegram', direction: 'in', message: { text: 'hello world' } },
    ]
    vm.messageFilter.channel = 'im-feishu'
    expect(vm.filteredMessages.length).toBe(1)
    vm.messageFilter.channel = ''
    vm.messageFilter.keyword = 'hello'
    expect(vm.filteredMessages.length).toBe(1)
  })
})
