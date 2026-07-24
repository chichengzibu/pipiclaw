import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CommandPalette from '../../../src/components/common/CommandPalette.vue'

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': {} } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/dashboard', component: { template: '<div />' } },
    { path: '/chat', component: { template: '<div />' } },
    { path: '/clawhub', component: { template: '<div />' } },
    { path: '/models', component: { template: '<div />' } },
    { path: '/im-management', component: { template: '<div />' } },
  ],
})

;(globalThis as any).window = (globalThis as any).window || {}

async function openPalette(): Promise<void> {
  window.dispatchEvent(new CustomEvent('cmd:open-palette'))
  await nextTick()
  await flushPromises()
  // 再等一帧,确保 v-if 渲染
  await new Promise((r) => setTimeout(r, 30))
  await nextTick()
  await flushPromises()
}
void openPalette // exported for future helper tests

describe('P5-UX: CommandPalette 命令面板(逻辑层)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('默认 open = false', () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    expect((w.vm as any).open).toBe(false)
  })

  it('cmd:open-palette 事件 → open = true', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    expect((w.vm as any).open).toBe(false)
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    expect((w.vm as any).open).toBe(true)
  })

  it('close() → open = false', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    expect((w.vm as any).open).toBe(true)
    ;(w.vm as any).close()
    await flushPromises()
    expect((w.vm as any).open).toBe(false)
  })

  it('默认 query 为空', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    expect((w.vm as any).query).toBe('')
  })

  it('groupedResults 默认至少 2 个分组(prompts + actions)', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    const gr = (w.vm as any).groupedResults as Array<{ items: unknown[] }>
    expect(gr.length).toBeGreaterThanOrEqual(2)
    // prompts 组
    const promptGroup = gr.find((g) => g.items.length > 0)
    expect(promptGroup).toBeDefined()
  })

  it('filteredCommands 按 query 过滤', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    ;(w.vm as any).query = '聊天'
    await flushPromises()
    const gr = (w.vm as any).groupedResults as Array<{ items: Array<{ title: string }> }>
    const allItems = gr.flatMap((g) => g.items)
    // 至少有一个 item title 含"AI 对话"或"对话"
    const hasChat = allItems.some((it) => it.title.includes('对话'))
    expect(hasChat).toBe(true)
  })

  it('filteredCommands 强不匹配的 query → 候选数明显减少', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    // 默认 query=空,候选很多
    const before = (w.vm as any).filteredCommands.length
    ;(w.vm as any).query = '完全没匹配的中文关键字_xyz_123'
    await flushPromises()
    const after = (w.vm as any).filteredCommands.length
    expect(after).toBeLessThan(before)
  })

  it('filteredCommands 不区分大小写', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    ;(w.vm as any).query = 'CHAT'
    await flushPromises()
    const gr = (w.vm as any).groupedResults as Array<{ items: Array<{ title: string }> }>
    const allItems = gr.flatMap((g) => g.items)
    expect(allItems.length).toBeGreaterThan(0)
  })

  it('filteredCommands 字符顺序模糊匹配', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    ;(w.vm as any).query = 'pylb' // 字符分散在 拼音 中
    await flushPromises()
    const gr = (w.vm as any).groupedResults as Array<{ items: Array<{ title: string }> }>
    const allItems = gr.flatMap((g) => g.items)
    // 至少返回一个 — 至少 fuzzy 命中 1 个
    expect(allItems.length).toBeGreaterThan(0)
  })

  it('recentConversations 初始为空', () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    expect((w.vm as any).recentConversations).toEqual([])
  })

  it('recentConversations 读取 localStorage', async () => {
    localStorage.setItem(
      'pipiclaw_recent_commands',
      JSON.stringify([{ id: 'r1', title: '测试', ts: Date.now() }]),
    )
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    const rec = (w.vm as any).recentConversations as Array<{ title: string }>
    expect(rec.length).toBe(1)
    expect(rec[0].title).toBe('测试')
  })

  it('commitItem 写 localStorage', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    // 直接调用 commitItem 拿第一个 item
    const gr = (w.vm as any).groupedResults as Array<{ items: Array<unknown> }>
    const firstItem = gr[0]?.items[0] as { id: string; title: string; action: () => void } | undefined
    expect(firstItem).toBeDefined()
    if (firstItem) {
      await (w.vm as any).commitItem(firstItem)
      const stored = JSON.parse(localStorage.getItem('pipiclaw_recent_commands') || '[]') as Array<unknown>
      expect(stored.length).toBeGreaterThan(0)
    }
  })

  it('commitItem 后 close()', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new CustomEvent('cmd:open-palette'))
    await flushPromises()
    expect((w.vm as any).open).toBe(true)
    const gr = (w.vm as any).groupedResults as Array<{ items: Array<unknown> }>
    const firstItem = gr[0]?.items[0] as { id: string; title: string; action: () => void } | undefined
    if (firstItem) {
      await (w.vm as any).commitItem(firstItem)
      expect((w.vm as any).open).toBe(false)
    }
  })
})

describe('P5-UX: CommandPalette 全局快捷键', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('Ctrl+K 打开面板', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    window.dispatchEvent(evt)
    await flushPromises()
    expect((w.vm as any).open).toBe(true)
  })

  it('Cmd+K 打开面板(macOS)', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    const evt = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    window.dispatchEvent(evt)
    await flushPromises()
    expect((w.vm as any).open).toBe(true)
  })

  it('Ctrl+K 第二次按下关闭', async () => {
    const w = mount(CommandPalette, { global: { plugins: [i18n, router] } })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await flushPromises()
    expect((w.vm as any).open).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await flushPromises()
    expect((w.vm as any).open).toBe(false)
  })
})
