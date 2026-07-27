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

describe('P3-02: IMMessageStore.search 全文搜索', () => {
  beforeEach(() => {
    ;(IMMessageStore as unknown as { instance: IMMessageStore | null }).instance = null
  })

  it('空查询 → 返回 []', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { text: 'hello', from: 'u1' } as any)
    expect(s.search({ query: '' })).toEqual([])
    expect(s.search({ query: '   ' })).toEqual([])
  })

  it('单关键词搜索 → 命中并返回 snippet', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { text: '今天需要处理 bug 报告', from: 'u1' } as any)
    s.record('ch-1', 'in', { text: '明天开会', from: 'u1' } as any)
    const hits = s.search({ query: 'bug' })
    expect(hits.length).toBe(1)
    expect(hits[0].matchedTerms).toEqual(['bug'])
    expect(hits[0].snippet).toContain('bug')
  })

  it('多关键词 (空格分隔) → 任一关键词命中都返回, 分数累加', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { text: '今天有 bug', from: 'u1' } as any)
    s.record('ch-1', 'in', { text: '明天有 bug report', from: 'u1' } as any)
    s.record('ch-1', 'in', { text: '今天有报告', from: 'u1' } as any)
    const hits = s.search({ query: 'bug report' })
    // 返回所有命中任一关键词的消息: bug-only(1分) + bug+report(2分) + report-only(1分)
    // "今天有报告" 不含 "report" (英文), 不命中
    expect(hits.length).toBe(2)
    // 第一名应该是 bug+report 都命中的
    expect(hits[0].matchedTerms.sort()).toEqual(['bug', 'report'])
    expect(hits[0].score).toBe(2)
  })

  it('标题 (subject) 命中分数 > 正文命中', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { subject: 'BUG fix needed', text: '无关内容', from: 'u1' } as any)
    s.record('ch-1', 'in', { text: '正文里有 bug 这个词', from: 'u1' } as any)
    const hits = s.search({ query: 'bug' })
    expect(hits.length).toBe(2)
    // 第一名应该是 subject 命中 (score >= 2)
    expect(hits[0].score).toBeGreaterThanOrEqual(2)
    expect(hits[0].message.message.subject).toBe('BUG fix needed')
  })

  it('按 channelId 过滤', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { text: 'bug 报告 1', from: 'u1' } as any)
    s.record('ch-2', 'in', { text: 'bug 报告 2', from: 'u1' } as any)
    const hits = s.search({ query: 'bug', channelId: 'ch-1' })
    expect(hits.length).toBe(1)
    expect(hits[0].message.channelId).toBe('ch-1')
  })

  it('按 senderId 过滤', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { text: 'bug 报告', from: 'alice' } as any)
    s.record('ch-1', 'in', { text: 'bug 报告', from: 'bob' } as any)
    const hits = s.search({ query: 'bug', senderId: 'alice' })
    expect(hits.length).toBe(1)
    expect(hits[0].message.message.from).toBe('alice')
  })

  it('按时间窗口过滤', () => {
    const s = IMMessageStore.getInstance()
    const old = s.record('ch-1', 'in', { text: 'old bug', from: 'u1' } as any)
    const recent = s.record('ch-1', 'in', { text: 'new bug', from: 'u1' } as any)
    // 模拟 old.ts 在 10 天前, recent.ts 在 1 天前
    ;(old as { ts: number }).ts = Date.now() - 10 * 24 * 60 * 60 * 1000
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const hits = s.search({ query: 'bug', sinceMs: sevenDaysAgo })
    expect(hits.length).toBe(1)
    expect(hits[0].message.id).toBe(recent.id)
  })

  it('按分数排序 (命中关键词多者优先)', () => {
    const s = IMMessageStore.getInstance()
    s.record('ch-1', 'in', { text: '只命中 bug', from: 'u1' } as any)
    s.record('ch-1', 'in', { text: '同时命中 bug 和 report', from: 'u1' } as any)
    const hits = s.search({ query: 'bug report' })
    expect(hits[0].message.message.text).toContain('同时命中')
  })

  it('snippet 包含上下文 (±30 字)', () => {
    const s = IMMessageStore.getInstance()
    const longText = 'A'.repeat(50) + ' bug ' + 'B'.repeat(50)
    s.record('ch-1', 'in', { text: longText, from: 'u1' } as any)
    const hits = s.search({ query: 'bug' })
    expect(hits[0].snippet).toContain('bug')
    // snippet 应包含 A 和 B (前后各 30 字)
    expect(hits[0].snippet).toMatch(/A/)
    expect(hits[0].snippet).toMatch(/B/)
  })

  it('limit 参数限制返回数', () => {
    const s = IMMessageStore.getInstance()
    for (let i = 0; i < 5; i++) {
      s.record('ch-1', 'in', { text: `bug ${i}`, from: 'u1' } as any)
    }
    const hits = s.search({ query: 'bug', limit: 3 })
    expect(hits.length).toBe(3)
  })
})
