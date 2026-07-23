import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-modelrate-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P1-08: 模型社区评分
 *
 * 验证 ModelRatingManager:
 * - rate(score 1-5)
 * - listForModel / listAll
 * - getStats 聚合
 * - 持久化
 */

import { ModelRatingManager } from '../../electron/models/ModelRatingManager'

const TEST_USER_DATA = '/tmp/pipiclaw-modelrate-test'

describe('P1-08: ModelRatingManager', () => {
  beforeEach(() => {
    ;(ModelRatingManager as unknown as { instance: ModelRatingManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton', () => {
    const a = ModelRatingManager.getInstance()
    const b = ModelRatingManager.getInstance()
    expect(a).toBe(b)
  })

  it('初始 listAll 空', () => {
    const m = ModelRatingManager.getInstance()
    expect(m.listAll()).toEqual([])
  })

  it('rate 添加 1 条', () => {
    const m = ModelRatingManager.getInstance()
    const r = m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u1', userName: 'Alice', score: 5, review: 'good' })
    expect(r.id).toMatch(/^rating-/)
    expect(r.score).toBe(5)
    expect(m.listAll().length).toBe(1)
  })

  it('score < 1 → 抛错', () => {
    const m = ModelRatingManager.getInstance()
    expect(() =>
      m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u', userName: 'n', score: 0, review: '' }),
    ).toThrow(/score 必须在 1-5/)
  })

  it('score > 5 → 抛错', () => {
    const m = ModelRatingManager.getInstance()
    expect(() =>
      m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u', userName: 'n', score: 6, review: '' }),
    ).toThrow(/score 必须在 1-5/)
  })

  it('modelId 缺 → 抛错', () => {
    const m = ModelRatingManager.getInstance()
    expect(() =>
      m.rate({ modelId: '', provider: 'openai', userId: 'u', userName: 'n', score: 5, review: '' }),
    ).toThrow(/modelId.*provider 必填/)
  })

  it('listForModel 按 modelId 过滤', () => {
    const m = ModelRatingManager.getInstance()
    m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u1', userName: 'A', score: 5, review: '' })
    m.rate({ modelId: 'gpt-4o-mini', provider: 'openai', userId: 'u2', userName: 'B', score: 4, review: '' })
    expect(m.listForModel('gpt-4o').length).toBe(1)
    expect(m.listForModel('gpt-4o-mini').length).toBe(1)
  })

  it('getStats 聚合:avg = sum / count', () => {
    const m = ModelRatingManager.getInstance()
    m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u1', userName: 'A', score: 5, review: '' })
    m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u2', userName: 'B', score: 3, review: '' })
    m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u3', userName: 'C', score: 4, review: '' })
    const stats = m.getStats()
    expect(stats.length).toBe(1)
    expect(stats[0].ratingCount).toBe(3)
    expect(stats[0].ratingSum).toBe(12)
    expect(stats[0].avgScore).toBe(4)
  })

  it('getStats 跨 provider 区分', () => {
    const m = ModelRatingManager.getInstance()
    m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u', userName: 'A', score: 5, review: '' })
    m.rate({ modelId: 'gpt-4o', provider: 'azure-openai', userId: 'u', userName: 'B', score: 3, review: '' })
    const stats = m.getStats()
    expect(stats.length).toBe(2)
  })

  it('持久化:rate 后文件存在', () => {
    const m = ModelRatingManager.getInstance()
    m.rate({ modelId: 'gpt-4o', provider: 'openai', userId: 'u', userName: 'A', score: 5, review: '' })
    const filePath = `${TEST_USER_DATA}/model-ratings.json`
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('重启后从磁盘恢复', () => {
    const m1 = ModelRatingManager.getInstance()
    m1.rate({ modelId: 'claude-3', provider: 'anthropic', userId: 'u', userName: 'A', score: 5, review: 'great' })
    ;(ModelRatingManager as unknown as { instance: ModelRatingManager | null }).instance = null
    const m2 = ModelRatingManager.getInstance()
    expect(m2.listForModel('claude-3').length).toBe(1)
  })

  it('clear 清空', () => {
    const m = ModelRatingManager.getInstance()
    m.rate({ modelId: 'a', provider: 'p', userId: 'u', userName: 'A', score: 5, review: '' })
    m.clear()
    expect(m.listAll().length).toBe(0)
  })
})
