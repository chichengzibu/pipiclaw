import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock electron API
const mockConfigStore: Record<string, unknown> = {}
;(globalThis as any).window = (globalThis as any).window || {}
;(window as any).electronAPI = {
  app: {
    getVersion: vi.fn().mockResolvedValue({ data: '4.1.0' }),
    getPlatform: vi.fn().mockReturnValue('win32'),
  },
  config: {
    get: vi.fn().mockImplementation(async (key: string) => ({ success: true, data: mockConfigStore[key] })),
    set: vi.fn().mockImplementation(async (key: string, value: unknown) => {
      mockConfigStore[key] = value
      return { success: true }
    }),
  },
}

// Mock matchMedia
let prefersDark = false
;(window as any).matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query.includes('dark') ? prefersDark : false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

import { useAppStore } from '../../../src/stores/app'

describe('P5-UX: AppStore 主题系统 (light/dark/system)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    prefersDark = false
    // 清空 mock config
    for (const k of Object.keys(mockConfigStore)) delete mockConfigStore[k]
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 清理 data-theme
    if (typeof document !== 'undefined') {
      delete document.documentElement.dataset.theme
      document.documentElement.classList.remove('dark', 'theme-transition')
    }
  })

  it('singleton', () => {
    const a = useAppStore()
    const b = useAppStore()
    expect(a).toBe(b)
  })

  it('默认 themeMode = system', () => {
    const store = useAppStore()
    expect(store.themeMode).toBe('system')
  })

  it('system 模式 + 系统浅色 → currentTheme = light', () => {
    prefersDark = false
    const store = useAppStore()
    expect(store.currentTheme).toBe('light')
  })

  it('system 模式 + 系统深色 → currentTheme = dark', () => {
    prefersDark = true
    const store = useAppStore()
    expect(store.currentTheme).toBe('dark')
  })

  it('setTheme("dark") → themeMode = dark + currentTheme = dark', () => {
    const store = useAppStore()
    store.setTheme('dark')
    expect(store.themeMode).toBe('dark')
    expect(store.currentTheme).toBe('dark')
  })

  it('setTheme("light") → themeMode = light + currentTheme = light', () => {
    const store = useAppStore()
    store.setTheme('light')
    expect(store.themeMode).toBe('light')
    expect(store.currentTheme).toBe('light')
  })

  it('setTheme 持久化到 config.set', async () => {
    const store = useAppStore()
    await store.setTheme('dark')
    expect((window as any).electronAPI.config.set).toHaveBeenCalledWith('theme', 'dark')
  })

  it('toggleTheme:light → dark', () => {
    const store = useAppStore()
    store.setTheme('light')
    store.toggleTheme()
    expect(store.themeMode).toBe('dark')
  })

  it('toggleTheme:dark → light', () => {
    const store = useAppStore()
    store.setTheme('dark')
    store.toggleTheme()
    expect(store.themeMode).toBe('light')
  })

  it('toggleTheme:system + 系统浅色 → dark', () => {
    prefersDark = false
    const store = useAppStore()
    store.toggleTheme()
    expect(store.themeMode).toBe('dark')
  })

  it('toggleTheme:system + 系统深色 → light', () => {
    prefersDark = true
    const store = useAppStore()
    store.toggleTheme()
    expect(store.themeMode).toBe('light')
  })

  it('applyTheme:light → data-theme="light" + html.dark 移除', () => {
    const store = useAppStore()
    store.setTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applyTheme:dark → data-theme="dark" + html.dark 添加', () => {
    const store = useAppStore()
    store.setTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applyTheme:system → 移除 data-theme attribute', () => {
    const store = useAppStore()
    document.documentElement.dataset.theme = 'dark'
    store.setTheme('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('applyTheme 切换时短暂添加 theme-transition class', async () => {
    const store = useAppStore()
    store.setTheme('dark')
    // applyTheme 同步设置,class 存在
    expect(document.documentElement.classList.contains('theme-transition')).toBe(true)
  })

  it('initialize:读取已保存的主题', async () => {
    mockConfigStore.theme = 'dark'
    const store = useAppStore()
    await store.initialize()
    expect(store.themeMode).toBe('dark')
  })

  it('initialize:保存的主题非法 → 保持 system', async () => {
    mockConfigStore.theme = 'rainbow'
    const store = useAppStore()
    await store.initialize()
    expect(store.themeMode).toBe('system')
  })

  it('initialize:无保存主题 → system', async () => {
    const store = useAppStore()
    await store.initialize()
    expect(store.themeMode).toBe('system')
  })

  it('initialize 后 initialized = true', async () => {
    const store = useAppStore()
    await store.initialize()
    expect(store.initialized).toBe(true)
  })

  it('initialize 异常时不抛错', async () => {
    ;(window as any).electronAPI.app.getVersion = vi.fn().mockRejectedValue(new Error('IPC fail'))
    const store = useAppStore()
    await expect(store.initialize()).resolves.toBeUndefined()
    expect(store.initialized).toBe(false)
    expect(store.initStatus).toBe('初始化失败')
  })

  it('markFirstLaunchComplete → isFirstLaunch=false + showGuide=false', async () => {
    const store = useAppStore()
    store.isFirstLaunch = true
    store.showGuide = true
    await store.markFirstLaunchComplete()
    expect(store.isFirstLaunch).toBe(false)
    expect(store.showGuide).toBe(false)
  })

  it('openGuide / closeGuide', () => {
    const store = useAppStore()
    store.showGuide = false
    store.openGuide()
    expect(store.showGuide).toBe(true)
    store.closeGuide()
    expect(store.showGuide).toBe(false)
  })

  it('setLanguage', () => {
    const store = useAppStore()
    store.setLanguage('en-US')
    expect(store.language).toBe('en-US')
  })
})
