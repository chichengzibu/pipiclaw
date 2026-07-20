import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-np-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { NetworkPolicy } from '../../electron/sandbox/networkPolicy'

describe('NetworkPolicy', () => {
  let np: NetworkPolicy

  beforeEach(() => {
    vi.clearAllMocks()
    np = NetworkPolicy.getInstance()
  })

  it('getInstance returns singleton', () => {
    expect(NetworkPolicy.getInstance()).toBe(np)
  })

  it('isAllowed returns true for default npm mirror', () => {
    expect(np.isAllowed('registry.npmmirror.com')).toBe(true)
  })

  it('isAllowed returns true for default pypi mirror', () => {
    expect(np.isAllowed('pypi.tuna.tsinghua.edu.cn')).toBe(true)
  })

  it('isAllowed returns true for AI API domain', () => {
    expect(np.isAllowed('api.openai.com')).toBe(true)
    expect(np.isAllowed('api.anthropic.com')).toBe(true)
  })

  it('isAllowed returns false for unknown host', () => {
    expect(np.isAllowed('evil.example.com')).toBe(false)
  })

  it('setBlockAll blocks all hosts except AI API', () => {
    np.setBlockAll(true)
    expect(np.isAllowed('registry.npmmirror.com')).toBe(false)
    expect(np.isAllowed('api.openai.com')).toBe(true)
    np.setBlockAll(false)
  })

  it('addEntry and removeEntry modifies whitelist', () => {
    np.addEntry({ domain: 'example.com', category: 'custom', enabled: true })
    expect(np.isAllowed('example.com')).toBe(true)
    const removed = np.removeEntry('example.com')
    expect(removed).toBe(true)
    expect(np.isAllowed('example.com')).toBe(false)
  })

  it('toggleEntry disables whitelist entry', () => {
    np.addEntry({ domain: 'foo.com', category: 'custom', enabled: true })
    np.toggleEntry('foo.com', false)
    expect(np.isAllowed('foo.com')).toBe(false)
    np.removeEntry('foo.com')
  })

  it('list returns all entries', () => {
    const list = np.list()
    expect(list.length).toBeGreaterThanOrEqual(9)
  })
})
