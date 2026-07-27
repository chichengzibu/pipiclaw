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

describe('P3-03: getMonthlyPrediction 月度费用预测', () => {
  beforeEach(() => {
    ;(ModelUsageTracker as unknown as { instance: ModelUsageTracker | null }).instance = null
    if (fs.existsSync('/tmp/pipiclaw-modelusage-test')) {
      fs.rmSync('/tmp/pipiclaw-modelusage-test', { recursive: true, force: true })
    }
  })

  it('无历史 → 全 0, confidence 最低 0.3', () => {
    const t = ModelUsageTracker.getInstance()
    const p = t.getMonthlyPrediction(7)
    expect(p.pastCost).toBe(0)
    expect(p.dailyCost).toBe(0)
    expect(p.projectedCost).toBe(0)
    expect(p.sampleCount).toBe(0)
    expect(p.confidence).toBe(0.3)
    expect(p.lowEstimate).toBe(0)
    expect(p.highEstimate).toBe(0)
  })

  it('基于过去 7 天总费用, projectedCost = dailyCost × 30', () => {
    const t = ModelUsageTracker.getInstance()
    // 模拟 7 天内 7 次调用, 每次 $1
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    for (let i = 0; i < 7; i++) {
      // 直接通过 push 进入 callHistory (绕过 record 的 Date.now 限制)
      ;(t as unknown as { callHistory: unknown[] }).callHistory.push({
        timestamp: now - i * oneDay,
        modelId: 'gpt-4',
        provider: 'openai',
        tokens: 1000,
        cost: 1.0,
      })
    }
    const p = t.getMonthlyPrediction(7)
    expect(p.pastCost).toBe(7)
    expect(p.dailyCost).toBeCloseTo(1, 5)
    expect(p.projectedCost).toBeCloseTo(30, 5)
    // 7 samples < 10 → margin=0.3 (扩大置信带)
    expect(p.lowEstimate).toBeCloseTo(30 * 0.7, 5)  // 30 × 0.7
    expect(p.highEstimate).toBeCloseTo(30 * 1.3, 5)
    expect(p.sampleCount).toBe(7)
  })

  it('样本 < 10 时, 置信带放宽到 ±30%', () => {
    const t = ModelUsageTracker.getInstance()
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    ;(t as unknown as { callHistory: unknown[] }).callHistory.push({
      timestamp: now - oneDay,
      modelId: 'gpt-4', provider: 'openai', tokens: 100, cost: 1.0,
    })
    const p = t.getMonthlyPrediction(7)
    // 1 sample, dailyCost = 1/7 ≈ 0.143, projected ≈ 4.286
    // ±30% margin → low = 4.286 × 0.7 = 3, high = 4.286 × 1.3 ≈ 5.57
    expect(p.lowEstimate).toBeCloseTo(p.projectedCost * 0.7, 5)
    expect(p.highEstimate).toBeCloseTo(p.projectedCost * 1.3, 5)
  })

  it('超过 7 天的旧调用不计入预测', () => {
    const t = ModelUsageTracker.getInstance()
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    // 10 天前: $100 (不应计入)
    ;(t as unknown as { callHistory: unknown[] }).callHistory.push({
      timestamp: now - 10 * oneDay,
      modelId: 'old', provider: 'p', tokens: 100, cost: 100,
    })
    // 3 天前: $3 (应计入)
    ;(t as unknown as { callHistory: unknown[] }).callHistory.push({
      timestamp: now - 3 * oneDay,
      modelId: 'new', provider: 'p', tokens: 100, cost: 3,
    })
    const p = t.getMonthlyPrediction(7)
    expect(p.pastCost).toBe(3)
    expect(p.sampleCount).toBe(1)
    expect(p.projectedCost).toBeCloseTo(3 / 7 * 30, 5)
  })

  it('样本 ≥ 30 → confidence 升到 1.0', () => {
    const t = ModelUsageTracker.getInstance()
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    for (let i = 0; i < 50; i++) {
      ;(t as unknown as { callHistory: unknown[] }).callHistory.push({
        timestamp: now - (i % 7) * oneDay, // 7 天内均匀分布
        modelId: 'm', provider: 'p', tokens: 100, cost: 0.1,
      })
    }
    const p = t.getMonthlyPrediction(7)
    expect(p.sampleCount).toBe(50)
    expect(p.confidence).toBeGreaterThanOrEqual(1)
    expect(p.lowEstimate).toBeCloseTo(p.projectedCost * 0.8, 5)  // 50 > 10 → ±20%
  })
})
