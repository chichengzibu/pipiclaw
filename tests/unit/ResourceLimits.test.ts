import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-rl-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { ResourceLimitsManager } from '../../electron/sandbox/resourceLimits'

describe('ResourceLimitsManager', () => {
  let mgr: ResourceLimitsManager

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ResourceLimitsManager as any).instance = null
    mgr = ResourceLimitsManager.getInstance()
    mgr.reset()  // 重置 maxConcurrent 等 limits
  })

  it('getInstance returns singleton', () => {
    expect(ResourceLimitsManager.getInstance()).toBe(mgr)
  })

  it('get returns default limits', () => {
    const limits = mgr.get()
    expect(limits.cpuCores).toBe(2)
    expect(limits.memoryMb).toBe(4096)
    expect(limits.diskMb).toBe(10240)
    expect(limits.timeoutMinutes).toBe(30)
    expect(limits.maxConcurrent).toBe(3)
  })

  it('set updates limits and persists', () => {
    mgr.set({ cpuCores: 4, memoryMb: 8192 })
    const limits = mgr.get()
    expect(limits.cpuCores).toBe(4)
    expect(limits.memoryMb).toBe(8192)
    expect(limits.diskMb).toBe(10240)
  })

  it('reset restores default values', () => {
    mgr.set({ cpuCores: 1, memoryMb: 1024 })
    mgr.reset()
    const limits = mgr.get()
    expect(limits.cpuCores).toBe(2)
    expect(limits.memoryMb).toBe(4096)
  })

  it('acquire returns ok when below maxConcurrent', () => {
    const r = mgr.acquire('sb-1')
    expect(r.ok).toBe(true)
    mgr.release('sb-1')
  })

  it('acquire returns ok=false when at maxConcurrent', () => {
    mgr.set({ maxConcurrent: 1 })
    const a = mgr.acquire('sb-a')
    expect(a.ok).toBe(true)
    const b = mgr.acquire('sb-b')
    expect(b.ok).toBe(false)
    expect(b.reason).toMatch(/max concurrent/)
    mgr.release('sb-a')
  })

  it('release frees slot for new acquire', () => {
    mgr.set({ maxConcurrent: 1 })
    mgr.acquire('sb-x')
    mgr.release('sb-x')
    const r = mgr.acquire('sb-y')
    expect(r.ok).toBe(true)
    mgr.release('sb-y')
  })

  it('listActive returns currently acquired sandbox ids', () => {
    mgr.acquire('sb-1')
    mgr.acquire('sb-2')
    const active = mgr.listActive()
    expect(active).toContain('sb-1')
    expect(active).toContain('sb-2')
    mgr.release('sb-1')
    mgr.release('sb-2')
  })
})
