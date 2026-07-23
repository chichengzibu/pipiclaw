import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-modelusage-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P2-02: 模型使用量排行
 */

import { ModelUsageTracker } from '../../electron/models/ModelUsageTracker'

const TEST_USER_DATA = '/tmp/pipiclaw-modelusage-test'

describe('P2-02: ModelUsageTracker', () => {
  beforeEach(() => {
    ;(ModelUsageTracker as unknown as { instance: ModelUsageTracker | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton', () => {
    const a = ModelUsageTracker.getInstance()
    const b = ModelUsageTracker.getInstance()
    expect(a).toBe(b)
  })

  it('初始 getAll 空', () => {
    const t = ModelUsageTracker.getInstance()
    expect(t.getAll()).toEqual([])
  })

  it('record 累加 tokens / cost / callCount', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('gpt-4o', 'openai', 100, 0.001)
    t.record('gpt-4o', 'openai', 200, 0.002)
    const all = t.getAll()
    expect(all.length).toBe(1)
    expect(all[0].tokens).toBe(300)
    expect(all[0].cost).toBeCloseTo(0.003)
    expect(all[0].callCount).toBe(2)
  })

  it('不同 model 各自分组', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('gpt-4o', 'openai', 100, 0.001)
    t.record('claude-3', 'anthropic', 200, 0.006)
    const all = t.getAll()
    expect(all.length).toBe(2)
  })

  it('getTop(n, tokens) 默认按 tokens 排序', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('a', 'openai', 100, 0.001)
    t.record('b', 'openai', 500, 0.005)
    t.record('c', 'openai', 300, 0.003)
    const top = t.getTop(3, 'tokens')
    expect(top[0].modelId).toBe('b')
    expect(top[1].modelId).toBe('c')
    expect(top[2].modelId).toBe('a')
  })

  it('getTop(n, cost) 按 cost 排', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('cheap', 'openai', 1000, 0.001)
    t.record('expensive', 'openai', 100, 0.5)
    const top = t.getTop(2, 'cost')
    expect(top[0].modelId).toBe('expensive')
  })

  it('getTop(n, calls) 按 callCount 排', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('a', 'openai', 100, 0.01)
    t.record('a', 'openai', 100, 0.01)
    t.record('a', 'openai', 100, 0.01)
    t.record('b', 'openai', 100, 0.01)
    const top = t.getTop(2, 'calls')
    expect(top[0].modelId).toBe('a')
    expect(top[0].callCount).toBe(3)
  })

  it('getTop 默认 10 个', () => {
    const t = ModelUsageTracker.getInstance()
    for (let i = 0; i < 15; i++) t.record(`m${i}`, 'p', i * 10, i * 0.001)
    expect(t.getTop().length).toBe(10)
  })

  it('getTotal 汇总', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('a', 'p', 100, 0.001)
    t.record('a', 'p', 100, 0.001)
    t.record('b', 'p', 200, 0.002)
    const total = t.getTotal()
    expect(total.totalTokens).toBe(400)
    expect(total.totalCost).toBeCloseTo(0.004)
    expect(total.totalCalls).toBe(3)
    expect(total.modelCount).toBe(2)
  })

  it('clear 清空', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('a', 'p', 100, 0.001)
    t.clear()
    expect(t.getAll()).toEqual([])
  })

  it('持久化:record 后文件存在', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('a', 'p', 100, 0.001)
    const filePath = `${TEST_USER_DATA}/model-usage.json`
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('重启后从磁盘恢复', () => {
    const t1 = ModelUsageTracker.getInstance()
    t1.record('a', 'p', 100, 0.001)
    ;(ModelUsageTracker as unknown as { instance: ModelUsageTracker | null }).instance = null
    const t2 = ModelUsageTracker.getInstance()
    expect(t2.getAll().length).toBe(1)
  })

  it('record 空 modelId → 静默忽略', () => {
    const t = ModelUsageTracker.getInstance()
    t.record('', 'p', 100, 0.001)
    expect(t.getAll()).toEqual([])
  })
})
