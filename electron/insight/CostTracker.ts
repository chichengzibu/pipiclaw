/**
 * PiPiClaw - Insight / CostTracker (W5.1)
 *
 * Per-model token usage + USD cost bookkeeping.
 * Persists to userData/cost-log.json. Provides today / recent / per-conversation aggregation
 * for the Insights view.
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'

export interface UsageEntry {
  id: string
  ts: number
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  conversationId?: string
  skillName?: string
}

export interface ModelPricing {
  inputPer1kUsd: number
  outputPer1kUsd: number
}

export interface TodayCostSummary {
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  byModel: Record<string, number>
}

export class CostTracker {
  private static instance: CostTracker
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private usages: UsageEntry[] = []
  private pricing: Map<string, ModelPricing> = new Map()
  private storePath: string

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'cost-log.json')
    this.loadFromDisk()
    this.seedDefaultPricing()
  }

  public static getInstance(): CostTracker {
    if (!CostTracker.instance) CostTracker.instance = new CostTracker()
    return CostTracker.instance
  }

  private seedDefaultPricing(): void {
    this.pricing.set('gpt-4o', { inputPer1kUsd: 0.005, outputPer1kUsd: 0.015 })
    this.pricing.set('gpt-4o-mini', { inputPer1kUsd: 0.00015, outputPer1kUsd: 0.0006 })
    this.pricing.set('claude-sonnet-4', { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 })
    this.pricing.set('ollama-llama3', { inputPer1kUsd: 0, outputPer1kUsd: 0 })
    this.pricing.set('zhipu-glm-4', { inputPer1kUsd: 0.001, outputPer1kUsd: 0.001 })
  }

  setPricing(model: string, p: ModelPricing): void {
    this.pricing.set(model, p)
  }

  getPricing(model: string): ModelPricing | undefined {
    return this.pricing.get(model)
  }

  recordUsage(
    entry: Omit<UsageEntry, 'id' | 'ts' | 'costUsd'> & { costUsd?: number },
  ): UsageEntry {
    const pricing = this.pricing.get(entry.model) ?? { inputPer1kUsd: 0, outputPer1kUsd: 0 }
    const computed =
      (entry.inputTokens / 1000) * pricing.inputPer1kUsd +
      (entry.outputTokens / 1000) * pricing.outputPer1kUsd
    const costUsd = entry.costUsd ?? computed
    const full: UsageEntry = {
      id: randomUUID(),
      ts: Date.now(),
      ...entry,
      costUsd,
    }
    this.usages.push(full)
    void this.bus.publish(
      'cost:usage:recorded',
      { model: full.model, costUsd: full.costUsd },
      'CostTracker',
    )
    this.persistToDisk()
    return full
  }

  getTodayCost(): TodayCostSummary {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayStart = startOfDay.getTime()
    const today = this.usages.filter((u) => u.ts >= todayStart)
    let totalCostUsd = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const byModel: Record<string, number> = {}
    for (const u of today) {
      totalCostUsd += u.costUsd
      totalInputTokens += u.inputTokens
      totalOutputTokens += u.outputTokens
      byModel[u.model] = (byModel[u.model] ?? 0) + u.costUsd
    }
    return { totalCostUsd, totalInputTokens, totalOutputTokens, byModel }
  }

  getRecentUsage(limit = 50): UsageEntry[] {
    return this.usages.slice(-limit)
  }

  getUsageByConversation(conversationId: string): UsageEntry[] {
    return this.usages.filter((u) => u.conversationId === conversationId)
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        this.usages = JSON.parse(data) as UsageEntry[]
      }
    } catch (e) {
      this.log.warn('CostTracker: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.usages))
    } catch (e) {
      this.log.warn('CostTracker: persist failed', e)
    }
  }
}