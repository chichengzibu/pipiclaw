/**
 * PiPiClaw - ModelUsageTracker (P2-02)
 *
 * 模型使用量排行:
 * - 每次 LLM 调用完,record(modelId, provider, tokens, cost)
 * - getTop(n) 返回使用量 Top N(按 tokens / cost 排)
 * - 持久化:userData/model-usage.json
 *
 * 用途:ModelCompare.vue 加 "使用量排行" Tab / 社区统计
 */

import { LogManager } from '../core/LogManager'
import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface UsageRecord {
  modelId: string
  provider: string
  /** 总 token 数(input + output) */
  tokens: number
  /** 总费用 USD */
  cost: number
  /** 调用次数 */
  callCount: number
  lastUsedAt: number
}

export interface UsageTopRow {
  modelId: string
  provider: string
  tokens: number
  cost: number
  callCount: number
}

export class ModelUsageTracker {
  private static instance: ModelUsageTracker
  private log = LogManager.getInstance()
  private storePath: string
  private records: Map<string, UsageRecord> = new Map()

  private constructor() {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
    this.storePath = path.join(userData, 'model-usage.json')
    this.load()
  }

  public static getInstance(): ModelUsageTracker {
    if (!ModelUsageTracker.instance) ModelUsageTracker.instance = new ModelUsageTracker()
    return ModelUsageTracker.instance
  }

  /**
   * 记录一次使用
   */
  record(modelId: string, provider: string, tokens: number, cost: number): void {
    if (!modelId) return
    const key = `${provider}::${modelId}`
    const r = this.records.get(key) ?? {
      modelId,
      provider,
      tokens: 0,
      cost: 0,
      callCount: 0,
      lastUsedAt: 0,
    }
    r.tokens += tokens
    r.cost += cost
    r.callCount += 1
    r.lastUsedAt = Date.now()
    this.records.set(key, r)
    this.persist()
  }

  /**
   * Top N 排行
   * sortBy: 'tokens' (default) | 'cost' | 'calls'
   */
  getTop(n: number = 10, sortBy: 'tokens' | 'cost' | 'calls' = 'tokens'): UsageTopRow[] {
    const list = [...this.records.values()]
    list.sort((a, b) => {
      if (sortBy === 'cost') return b.cost - a.cost
      if (sortBy === 'calls') return b.callCount - a.callCount
      return b.tokens - a.tokens
    })
    return list.slice(0, n).map((r) => ({
      modelId: r.modelId,
      provider: r.provider,
      tokens: r.tokens,
      cost: r.cost,
      callCount: r.callCount,
    }))
  }

  /**
   * 全量记录(给管理面板 / 调试)
   */
  getAll(): UsageRecord[] {
    return [...this.records.values()]
  }

  /**
   * 总统计
   */
  getTotal(): { totalTokens: number; totalCost: number; totalCalls: number; modelCount: number } {
    let totalTokens = 0
    let totalCost = 0
    let totalCalls = 0
    for (const r of this.records.values()) {
      totalTokens += r.tokens
      totalCost += r.cost
      totalCalls += r.callCount
    }
    return {
      totalTokens,
      totalCost,
      totalCalls,
      modelCount: this.records.size,
    }
  }

  clear(): void {
    this.records.clear()
    this.persist()
  }

  private persist(): void {
    try {
      const obj = Object.fromEntries(this.records)
      fs.writeFileSync(this.storePath, JSON.stringify(obj, null, 2))
    } catch (e) {
      this.log.warn('ModelUsageTracker: persist failed', e)
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const obj = JSON.parse(fs.readFileSync(this.storePath, 'utf-8')) as Record<string, UsageRecord>
        for (const [k, v] of Object.entries(obj)) this.records.set(k, v)
      }
      this.log.info(`ModelUsageTracker: 加载 ${this.records.size} models`)
    } catch (e) {
      this.log.warn('ModelUsageTracker: load failed', e)
    }
  }
}
