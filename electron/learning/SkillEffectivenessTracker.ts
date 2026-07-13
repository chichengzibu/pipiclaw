import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface SkillUsageStat {
  skillName: string
  calls: number
  successes: number
  failures: number
  avgDurationMs: number
  satisfactionScore?: number
  lastCalledAt: number
}

export interface SkillCallRecord {
  skillName: string
  ts: number
  durationMs: number
  success: boolean
  conversationId?: string
  overridden?: boolean
}

/**
 * SkillEffectivenessTracker: 跟踪 skill 调用效果 + 用户满意度。
 * 持久化到 ~/.pipiclaw/skill-stats.json
 * 主要消费者:InsightManager(给 Insights 看板用) + SkillVersioning 自动推荐回滚
 */
export class SkillEffectivenessTracker {
  private static instance: SkillEffectivenessTracker
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private records: SkillCallRecord[] = []
  private storePath: string
  private maxRecords = 1000

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'skill-stats.json')
    this.loadFromDisk()
  }

  public static getInstance(): SkillEffectivenessTracker {
    if (!SkillEffectivenessTracker.instance) SkillEffectivenessTracker.instance = new SkillEffectivenessTracker()
    return SkillEffectivenessTracker.instance
  }

  record(record: SkillCallRecord): void {
    this.records.push(record)
    if (this.records.length > this.maxRecords) this.records.shift()
    void this.bus.publish('skill:effectiveness:recorded', { skillName: record.skillName, success: record.success })
    this.persistToDisk()
  }

  getStats(skillName: string): SkillUsageStat | undefined {
    const records = this.records.filter(r => r.skillName === skillName)
    if (records.length === 0) return undefined
    const successes = records.filter(r => r.success).length
    const failures = records.length - successes
    const avg = records.reduce((s, r) => s + r.durationMs, 0) / records.length
    const lastCalledAt = Math.max(...records.map(r => r.ts))
    const overrideRate = records.filter(r => r.overridden).length / records.length
    return {
      skillName,
      calls: records.length,
      successes,
      failures,
      avgDurationMs: avg,
      satisfactionScore: 1 - overrideRate,
      lastCalledAt,
    }
  }

  listAllStats(): SkillUsageStat[] {
    const skillNames = Array.from(new Set(this.records.map(r => r.skillName)))
    return skillNames.map(n => this.getStats(n)!).filter(Boolean)
  }

  recommendRollback(skillName: string): boolean {
    const stats = this.getStats(skillName)
    if (!stats) return false
    return stats.calls >= 3 && stats.successes / stats.calls < 0.5
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        this.records = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
    } catch (e) {
      this.log.warn('SkillEffectivenessTracker: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.records))
    } catch (e) {
      this.log.warn('SkillEffectivenessTracker: persist failed', e)
    }
  }
}