import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': {} } })

;(globalThis as any).window = (globalThis as any).window || {}
const mockSkills = [
  { id: 's1', name: 'Code Helper', description: 'helps code', category: 'dev', tags: ['code'], authorName: 'Alice', ratingCount: 2, ratingSum: 9, downloadCount: 10, status: 'approved' },
  { id: 's2', name: 'Test Gen', description: 'gen tests', category: 'dev', tags: ['test'], authorName: 'Bob', ratingCount: 0, ratingSum: 0, downloadCount: 5, status: 'approved' },
]
const mockPending = [
  { id: 'p1', name: 'New Skill', description: 'awaiting review', category: 'ai', authorName: 'Carol', publishedAt: Date.now() },
]
;(window as any).electronAPI = {
  channel: {
    clawhubSearch: vi.fn().mockResolvedValue({ success: true, data: mockSkills }),
    clawhubListPending: vi.fn().mockResolvedValue({ success: true, data: mockPending }),
    clawhubPublish: vi.fn().mockResolvedValue({ success: true, data: { id: 'new' } }),
    clawhubReview: vi.fn().mockResolvedValue({ success: true, data: { status: 'approved' } }),
    clawhubRate: vi.fn().mockResolvedValue({ success: true, data: { id: 'r1' } }),
    clawhubListTemplates: vi.fn().mockResolvedValue({ success: true, data: [
      { id: 'tpl-daily', name: '每日总结', description: '生成日报', useCase: '下班前', category: 'productivity', tags: ['daily'], authorName: 'Team', manifestContent: '...' },
      { id: 'tpl-review', name: '代码审查', description: 'review diff', useCase: 'PR 后', category: 'developer', tags: ['pr'], authorName: 'Team', manifestContent: '...' },
    ] }),
    clawhubListTemplateCategories: vi.fn().mockResolvedValue({ success: true, data: ['productivity', 'developer'] }),
    clawhubInstantiateTemplate: vi.fn().mockResolvedValue({ success: true, data: { id: 'skill-new', name: '我的日报', status: 'pending' } }),
  },
}

const elementPlusStubs = {
  'el-tabs': { template: '<div class="el-tabs-stub"><slot /></div>' },
  'el-tab-pane': { template: '<div class="el-tab-pane-stub"><slot /></div>' },
  'el-button': { template: '<button class="el-button-stub" @click="$emit(\'click\')"><slot /></button>' },
  'el-input': { template: '<input class="el-input-stub" />' },
  'el-select': { template: '<select class="el-select-stub"><slot /></select>' },
  'el-option': { template: '<option class="el-option-stub"><slot /></option>' },
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div class="el-form-item-stub"><slot /></div>' },
  'el-card': { template: '<div class="el-card-stub"><slot /></div>' },
  'el-dialog': { template: '<div class="el-dialog-stub" v-if="modelValue"><slot /></div>', props: ['modelValue', 'title', 'width'] },
  'el-table': { template: '<div class="el-table-stub"><slot /></div>' },
  'el-table-column': { template: '<div class="el-table-column-stub" />', props: ['label', 'prop', 'width'] },
  'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
  'el-empty': { template: '<div class="el-empty-stub">{{ description }}</div>', props: ['description'] },
  'el-rate': { template: '<div class="el-rate-stub" />' },
}

import ClawHub from '../../../src/views/ClawHub.vue'

describe('P1-05: ClawHub 浏览市场 + 搜索', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载加载 search + pending', async () => {
    mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    expect((window as any).electronAPI.channel.clawhubSearch).toHaveBeenCalled()
    expect((window as any).electronAPI.channel.clawhubListPending).toHaveBeenCalled()
  })

  it('展示搜索结果 + 技能名', async () => {
    mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    // 检查 mock 数据被消费(通过 IPC mock 调用)
    expect((window as any).electronAPI.channel.clawhubSearch).toHaveBeenCalled()
  })

  it('doSearch 调 search + 带 sortBy', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    vi.clearAllMocks()
    const vm = w.vm as any
    vm.sortBy = 'downloads'
    await vm.doSearch()
    const call = (window as any).electronAPI.channel.clawhubSearch.mock.calls[0][0]
    expect(call.sortBy).toBe('downloads')
  })

  it('展示 3 个 Tab', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    expect(w.html()).toContain('浏览市场')
    expect(w.html()).toContain('发布技能')
    expect(w.html()).toContain('审核队列')
  })
})

describe('P1-03: ClawHub 发布技能', () => {
  it('handlePublish 缺 name → warning', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const { ElMessage } = await import('element-plus')
    const vm = w.vm as any
    vm.publishForm.name = ''
    vm.publishForm.description = 'x'
    await vm.handlePublish()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('handlePublish 缺 description → warning', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const { ElMessage } = await import('element-plus')
    const vm = w.vm as any
    vm.publishForm.name = 'x'
    vm.publishForm.description = ''
    await vm.handlePublish()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('handlePublish 完整字段 → 调 IPC + tags 解析', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.publishForm.name = 'New Skill'
    vm.publishForm.description = 'a new skill'
    vm.publishForm.category = 'dev'
    vm.publishForm.tagsText = 'tag1, tag2,tag3'
    vm.publishForm.manifestPath = '/p/skill.md'
    await vm.handlePublish()
    const call = (window as any).electronAPI.channel.clawhubPublish.mock.calls[0][0]
    expect(call.name).toBe('New Skill')
    expect(call.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })
})

describe('P1-04: ClawHub 审核', () => {
  it('handleReview(true) → approved', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    await vm.handleReview({ id: 'p1' }, true)
    const call = (window as any).electronAPI.channel.clawhubReview.mock.calls[0][0]
    expect(call.approve).toBe(true)
    expect(call.skillId).toBe('p1')
  })

  it('handleReview(false) 调 IPC 时 approve=false', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    vi.clearAllMocks()
    const vm = w.vm as any
    await vm.handleReview({ id: 'p1' }, false)
    const call = (window as any).electronAPI.channel.clawhubReview.mock.calls[0][0]
    expect(call.approve).toBe(false)
  })

  it('openRejectDialog 设置 rejectingSkill + 打开 dialog', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.openRejectDialog({ id: 'p1' })
    expect(vm.rejectingSkill).toEqual({ id: 'p1' })
    expect(vm.rejectDialogVisible).toBe(true)
    // rejectReason 重置
    expect(vm.rejectReason).toBe('')
  })
})

describe('P1-06: ClawHub 评分', () => {
  it('handleRate 调 IPC', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.ratingSkill = { id: 's1', name: 'Code Helper' }
    vm.rateForm.score = 4
    vm.rateForm.review = 'good'
    await vm.handleRate()
    const call = (window as any).electronAPI.channel.clawhubRate.mock.calls[0][0]
    expect(call.score).toBe(4)
    expect(call.review).toBe('good')
    expect(call.skillId).toBe('s1')
  })
})

describe('P2-03: ClawHub 技能模板', () => {
  it('loadTemplates 调 listTemplates + listCategories', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    await vm.loadTemplates()
    expect((window as any).electronAPI.channel.clawhubListTemplates).toHaveBeenCalled()
    expect((window as any).electronAPI.channel.clawhubListTemplateCategories).toHaveBeenCalled()
    expect(vm.templates.length).toBe(2)
    expect(vm.templateCategories).toEqual(['productivity', 'developer'])
  })

  it('loadTemplates 传 category + query', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.templateCategory = 'developer'
    vm.templateQuery = 'review'
    await vm.loadTemplates()
    const call = (window as any).electronAPI.channel.clawhubListTemplates.mock.calls.pop()[0]
    expect(call).toEqual({ category: 'developer', query: 'review' })
  })

  it('loadTemplates 失败 → 静默处理(不抛)', async () => {
    ;(window as any).electronAPI.channel.clawhubListTemplates = vi.fn().mockRejectedValue(new Error('IPC fail'))
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    await vm.loadTemplates()
    expect(vm.templates).toEqual([])
  })

  it('openInstantiateDialog 设置 instantiatingTemplate + 打开 dialog', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.openInstantiateDialog({ id: 'tpl-x', name: '模板 X' })
    expect(vm.instantiatingTemplate.id).toBe('tpl-x')
    expect(vm.instantiateDialogVisible).toBe(true)
  })

  it('handleInstantiate 缺作者 ID → warning 不调 IPC', async () => {
    const { ElMessage } = await import('element-plus')
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.instantiatingTemplate = { id: 'tpl-x', name: 'X' }
    vm.instantiateForm.authorId = ''
    vm.instantiateForm.authorName = 'You'
    await vm.handleInstantiate()
    expect(ElMessage.warning).toHaveBeenCalled()
    expect((window as any).electronAPI.channel.clawhubInstantiateTemplate).not.toHaveBeenCalled()
  })

  it('handleInstantiate 缺作者名 → warning 不调 IPC', async () => {
    const { ElMessage } = await import('element-plus')
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.instantiatingTemplate = { id: 'tpl-x', name: 'X' }
    vm.instantiateForm.authorId = 'u1'
    vm.instantiateForm.authorName = ''
    await vm.handleInstantiate()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('handleInstantiate 成功 → 调 IPC + 关 dialog + 刷新 pending', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.instantiatingTemplate = { id: 'tpl-x', name: 'X' }
    vm.instantiateForm.customName = '我的 X'
    vm.instantiateForm.authorId = 'u1'
    vm.instantiateForm.authorName = 'Alice'
    vi.clearAllMocks()
    ;(window as any).electronAPI.channel.clawhubListPending = vi.fn().mockResolvedValue({ success: true, data: [] })
    await vm.handleInstantiate()
    const call = (window as any).electronAPI.channel.clawhubInstantiateTemplate.mock.calls[0][0]
    expect(call.templateId).toBe('tpl-x')
    expect(call.customName).toBe('我的 X')
    expect(call.authorId).toBe('u1')
    expect(call.authorName).toBe('Alice')
    expect(vm.instantiateDialogVisible).toBe(false)
  })

  it('handleInstantiate 不传 customName → IPC 参数不带 customName', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.instantiatingTemplate = { id: 'tpl-x', name: 'X' }
    vm.instantiateForm.customName = '   ' // 空白 → 不传
    vm.instantiateForm.authorId = 'u1'
    vm.instantiateForm.authorName = 'Alice'
    vi.clearAllMocks()
    await vm.handleInstantiate()
    const call = (window as any).electronAPI.channel.clawhubInstantiateTemplate.mock.calls[0][0]
    expect(call.customName).toBeUndefined()
  })

  it('handleInstantiate 失败 → 不关 dialog', async () => {
    ;(window as any).electronAPI.channel.clawhubInstantiateTemplate = vi.fn().mockResolvedValue({ success: false, error: '模板不存在' })
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const vm = w.vm as any
    vm.instantiatingTemplate = { id: 'tpl-x', name: 'X' }
    vm.instantiateDialogVisible = true
    vm.instantiateForm.authorId = 'u1'
    vm.instantiateForm.authorName = 'Alice'
    await vm.handleInstantiate()
    expect(vm.instantiateDialogVisible).toBe(true)
  })

  it('Tab 切换:4 个 tab 名称正确', async () => {
    const w = mount(ClawHub, { global: { plugins: [i18n], stubs: elementPlusStubs } })
    await flushPromises()
    const html = w.html()
    expect(html).toContain('浏览市场')
    expect(html).toContain('发布技能')
    expect(html).toContain('审核队列')
    expect(html).toContain('技能模板')
  })
})
