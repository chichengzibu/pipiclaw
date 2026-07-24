import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import UpdateBanner from '../../../src/components/common/UpdateBanner.vue'

;(globalThis as any).window = (globalThis as any).window || {}

describe('P5-UX: UpdateBanner 顶部更新提示', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('默认不渲染', () => {
    const w = mount(UpdateBanner)
    expect(w.find('.update-banner').exists()).toBe(false)
  })

  it('autoUpdater:onUpdateAvailable → 渲染 info banner', async () => {
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onUpdateAvailable', {
        detail: { version: '4.2.0', releaseNotes: '新增 IM 模板 + 修复 bug' },
      }),
    )
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(w.find('.update-banner').exists()).toBe(true)
    expect(w.find('.update-banner').classes()).toContain('update-banner--info')
    expect(w.text()).toContain('4.2.0')
  })

  it('autoUpdater:onUpdateDownloaded → success banner', async () => {
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onUpdateDownloaded', { detail: { version: '4.2.0' } }),
    )
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(w.find('.update-banner--success').exists()).toBe(true)
    expect(w.text()).toContain('已下载完成')
  })

  it('autoUpdater:onError → error banner', async () => {
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onError', { detail: { message: 'Network error' } }),
    )
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(w.find('.update-banner--error').exists()).toBe(true)
  })

  it('error banner 5s 后自动消失', async () => {
    vi.useFakeTimers()
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onError', { detail: { message: 'fail' } }),
    )
    await nextTick()
    expect(w.find('.update-banner--error').exists()).toBe(true)
    vi.advanceTimersByTime(5100)
    await nextTick()
    // 触发响应式更新
    expect(w.vm.visible).toBe(false)
    vi.useRealTimers()
  })

  it('手动 dismiss → banner 消失', async () => {
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onUpdateAvailable', { detail: { version: '4.2.0' } }),
    )
    await nextTick()
    expect(w.find('.update-banner').exists()).toBe(true)
    ;(w.vm as any).dismiss()
    await nextTick()
    expect(w.vm.visible).toBe(false)
  })

  it('组件卸载时清理 timer', async () => {
    vi.useFakeTimers()
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onError', { detail: { message: 'fail' } }),
    )
    await nextTick()
    w.unmount()
    // 不抛错即可
    vi.advanceTimersByTime(10000)
    vi.useRealTimers()
  })

  it('releaseNotes 字符串正常显示', async () => {
    const w = mount(UpdateBanner)
    const longNotes = '修复了一些 bug\n\n改进了性能\n\n新增了功能'
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onUpdateAvailable', {
        detail: { version: '4.2.0', releaseNotes: longNotes },
      }),
    )
    await nextTick()
    expect(w.text()).toContain('修复了一些 bug')
  })

  it('releaseNotes 数组形式 → join 显示', async () => {
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onUpdateAvailable', {
        detail: {
          version: '4.2.0',
          releaseNotes: [{ note: 'Fix A' }, { note: 'Fix B' }],
        },
      }),
    )
    await nextTick()
    expect(w.text()).toContain('Fix A')
    expect(w.text()).toContain('Fix B')
  })

  it('releaseNotes 数组字符串 → join', async () => {
    const w = mount(UpdateBanner)
    window.dispatchEvent(
      new CustomEvent('autoUpdater:onUpdateAvailable', {
        detail: { version: '4.2.0', releaseNotes: ['First', 'Second'] },
      }),
    )
    await nextTick()
    expect(w.text()).toContain('First')
    expect(w.text()).toContain('Second')
  })
})
