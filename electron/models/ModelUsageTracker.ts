/**
 * PiPiClaw - ModelUsageTracker (P2-02)
 *
 * 模型使用量排行:
 * - 每次 LLM 调用完,record(modelId, provider, tokens, cost)
 * - getTop(n) 返回使用量 Top N(按 tokens / cost 排)
 * - getMonthlyPrediction() 基于过去 7 天均摊预测月度费用 (P3-03)
 * - 持久化:userData/model-usage.json
 *
 * 用途:ModelCompare.vue 加 "使用量排行" Tab / 社区统计 / Settings 预测卡
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

/** 单次调用记录 (P3-03 用于月度预测) */
export interface UsageCallEntry {
  timestamp: number
  modelId: string
  provider: string
  tokens: number
  cost: number
}

export interface UsageTopRow {
  modelId: string
  provider: string
  tokens: number
  cost: number
  callCount: number
}

/**
 * 月度预测结果 (P3-03)
 *   估算方法: 过去 N 天日均费用 × 30, 加 ±20% 置信带
 */
export interface MonthlyPrediction {
  /** 过去 N 天的总费用 */
  pastCost: number
  /** 日均费用 */
  dailyCost: number
  /** 月度预测 (dailyCost × 30) */
  projectedCost: number
  /** 置信区间下限 (-20%) */
  lowEstimate: number
  /** 置信区间上限 (+20%) */
  highEstimate: number
  /** 用于估算的窗口天数 */
  windowDays: number
  /** 用于估算的样本数(调用次数) */
  sampleCount: number
  /** 估算置信度: 0-1 (样本越多, 置信越高) */
  confidence: number
}

export class ModelUsageTracker {
  private static instance: ModelUsageTracker
  private log = LogManager.getInstance()
  private storePath: string
  private records: Map<string, UsageRecord> = new Map()
  /** P3-03: 单次调用日志, 用于时间窗口统计 */
  private callHistory: UsageCallEntry[] = []
  /** 最大保留 N 条历史(滚动窗口,避免无限增长) */
  private static readonly MAX_HISTORY = 5000

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
    // P3-03: 追加到调用历史(滚动窗口)
    this.callHistory.push({
      timestamp: r.lastUsedAt,
      modelId,
      provider,
      tokens,
      cost,
    })
    if (this.callHistory.length > ModelUsageTracker.MAX_HISTORY) {
      this.callHistory.splice(0, this.callHistory.length - ModelUsageTracker.MAX_HISTORY)
    }
    this.persist()
  }

  /**
   * P3-03: 基于过去 N 天历史, 预测月度费用
   * 算法: dailyCost = sum(cost in past N days) / N
   *       projected = dailyCost × 30
   *       置信带: ±20% (sampleCount < 10 时, ±30%)
   */
  getMonthlyPrediction(windowDays = 7): MonthlyPrediction {
    const now = Date.now()
    const cutoff = now - windowDays * 24 * 60 * 60 * 1000
    const recent = this.callHistory.filter((c) => c.timestamp >= cutoff)
    const pastCost = recent.reduce((sum, c) => sum + c.cost, 0)
    const dailyCost = pastCost / windowDays
    const projectedCost = dailyCost * 30
    // 置信度: 样本越多置信越高, ≥30 样本 → 1.0, ≤3 样本 → 0.3
    const confidence = Math.min(1, 0.3 + (recent.length / 30) * 0.7)
    // 样本少时拉宽置信带
    const margin = recent.length < 10 ? 0.3 : 0.2
    return {
      pastCost,
      dailyCost,
      projectedCost,
      lowEstimate: projectedCost * (1 - margin),
      highEstimate: projectedCost * (1 + margin),
      windowDays,
      sampleCount: recent.length,
      confidence,
    }
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
      const obj = {
        records: Object.fromEntries(this.records),
        callHistory: this.callHistory,
      }
      fs.writeFileSync(this.storePath, JSON.stringify(obj, null, 2))
    } catch (e) {
      this.log.warn('ModelUsageTracker: persist failed', e)
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        this.log.info('ModelUsageTracker: 无历史文件,从空开始')
        return
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf-8')) as
        | Record<string, UsageRecord>
        | { records?: Record<string, UsageRecord>; callHistory?: UsageCallEntry[] }
      // 兼容旧版 schema (只有 records)
      if (raw && typeof raw === 'object' && 'records' in raw && raw.records) {
        for (const [k, v] of Object.entries(raw.records)) this.records.set(k, v)
        this.callHistory = raw.callHistory ?? []
      } else if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, UsageRecord>)) this.records.set(k, v)
      }
      this.log.info(
        `ModelUsageTracker: 加载 ${this.records.size} models + ${this.callHistory.length} call history`,
      )
    } catch (e) {
      this.log.warn('ModelUsageTracker: load failed', e)
    }
  }
}
