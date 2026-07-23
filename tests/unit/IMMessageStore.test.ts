import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-immsg-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P0-02 + P0-03: IM 消息存储
 *
 * 验证 IMMessageStore:
 * - record / query / getById
 * - getStats 今日消息统计(按 channel 分组)
 * - FIFO 上限 1000
 */

import { IMMessageStore } from '../../electron/channel/IMMessageStore'

describe('P0-02/03: IMMessageStore 基础 CRUD', () => {
  beforeEach(() => {
    ;(IMMessageStore as unknown as { instance: IMMessageStore | null }).instance = null
  })

  it('singleton returns same instance', () => {
    const a = IMMessageStore.getInstance()
    const b = IMMessageStore.getInstance()
    expect(a).toBe(b)
  })

  it('初始 query 返回空数组', () => {
    const store = IMMessageStore.getInstance()
    expect(store.query()).toEqual([])
  })

  it('record + query 能取到', () => {
    const store = IMMessageStore.getInstance()
    const m = store.record('ch-1', 'in', { id: 'msg-1', text: 'hello', channel: 'feishu' } as any)
    expect(m.id).toBeTruthy()
    expect(m.direction).toBe('in')
    const all = store.query()
    expect(all.length).toBe(1)
  })

  it('query 按 channelId 过滤', () => {
    const store = IMMessageStore.getInstance()
    store.record('ch-1', 'in', { text: 'a' } as any)
    store.record('ch-2', 'in', { text: 'b' } as any)
    expect(store.query({ channelId: 'ch-1' }).length).toBe(1)
    expect(store.query({ channelId: 'ch-2' }).length).toBe(1)
  })

  it('query 按 direction 过滤', () => {
    const store = IMMessageStore.getInstance()
    store.record('ch-1', 'in', { text: 'a' } as any)
    store.record('ch-1', 'out', { text: 'b' } as any)
    expect(store.query({ direction: 'in' }).length).toBe(1)
    expect(store.query({ direction: 'out' }).length).toBe(1)
  })

  it('query limit 限制返回条数', () => {
    const store = IMMessageStore.getInstance()
    for (let i = 0; i < 10; i++) store.record('ch-1', 'in', { text: `m${i}` } as any)
    expect(store.query({ limit: 3 }).length).toBe(3)
  })

  it('FIFO 上限 1000:超过 1000 自动丢最早', () => {
    const store = IMMessageStore.getInstance()
    for (let i = 0; i < 1050; i++) store.record('ch-1', 'in', { text: `m${i}` } as any)
    expect(store.query({ limit: 2000 }).length).toBe(1000)
  })

  it('getById 找到对应消息', () => {
    const store = IMMessageStore.getInstance()
    const m = store.record('ch-1', 'in', { text: 'x' } as any)
    expect(store.getById(m.id)?.id).toBe(m.id)
  })

  it('getById 不存在返回 undefined', () => {
    const store = IMMessageStore.getInstance()
    expect(store.getById('nope')).toBeUndefined()
  })

  it('clear 清空', () => {
    const store = IMMessageStore.getInstance()
    store.record('ch-1', 'in', { text: 'a' } as any)
    store.clear()
    expect(store.query().length).toBe(0)
  })
})

describe('P0-02: IMMessageStore.getStats 今日统计', () => {
  beforeEach(() => {
    ;(IMMessageStore as unknown as { instance: IMMessageStore | null }).instance = null
  })

  it('空 store stats: total 0, byChannel 空', () => {
    const store = IMMessageStore.getInstance()
    const stats = store.getStats()
    expect(stats.total).toBe(0)
    expect(stats.byChannel).toEqual({})
  })

  it('record 5 条 → stats total 5', () => {
    const store = IMMessageStore.getInstance()
    for (let i = 0; i < 5; i++) store.record('ch-1', 'in', { text: `m${i}` } as any)
    const stats = store.getStats()
    expect(stats.total).toBe(5)
    expect(stats.byChannel['ch-1'].total).toBe(5)
  })

  it('按 channel 分组 in/out 统计', () => {
    const store = IMMessageStore.getInstance()
    store.record('feishu', 'in', { text: 'a' } as any)
    store.record('feishu', 'in', { text: 'b' } as any)
    store.record('feishu', 'out', { text: 'c' } as any)
    store.record('telegram', 'in', { text: 'd' } as any)
    const stats = store.getStats()
    expect(stats.byChannel['feishu'].in).toBe(2)
    expect(stats.byChannel['feishu'].out).toBe(1)
    expect(stats.byChannel['feishu'].total).toBe(3)
    expect(stats.byChannel['telegram'].in).toBe(1)
    expect(stats.byChannel['telegram'].total).toBe(1)
  })

  it('sinceMs 早于今天 0 点,只统计今日消息', async () => {
    const store = IMMessageStore.getInstance()
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000
    store.record('ch-1', 'in', { text: 'future' } as any)
    // 假设 todayStart = 明天 0 点
    const d = new Date(tomorrow)
    d.setHours(0, 0, 0, 0)
    const tomorrowStart = d.getTime()
    // 此时所有消息的 ts < sinceMs → 0
    const stats = store.getStats({ sinceMs: tomorrowStart })
    expect(stats.total).toBe(0)
  })
})
