/**
 * PiPiClaw - ModelRatingManager (P1-08)
 *
 * 模型社区评分(1-5 星 + 短评),数据本地化
 * 用 userData/model-ratings.json 持久化
 *
 * 用途:
 *  - 收集用户对各 LLM 模型(gpt-4o / claude-3 / glm-4 等)的真实使用感受
 *  - 后续 P1-07 模型性价比对比用此评分排序
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface ModelRating {
  id: string
  modelId: string  // 模型标识,如 "gpt-4o-mini"
  provider: string // openai / anthropic / zhipu
  userId: string
  userName: string
  /** 1-5 星 */
  score: number
  /** 短评 */
  review: string
  createdAt: number
}

export interface ModelStats {
  modelId: string
  provider: string
  ratingSum: number
  ratingCount: number
  /** 平均分(ratingCount=0 时为 0) */
  avgScore: number
}

export class ModelRatingManager {
  private static instance: ModelRatingManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storePath: string
  private ratings: ModelRating[] = []

  private constructor() {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
    this.storePath = path.join(userData, 'model-ratings.json')
    this.load()
  }

  public static getInstance(): ModelRatingManager {
    if (!ModelRatingManager.instance) ModelRatingManager.instance = new ModelRatingManager()
    return ModelRatingManager.instance
  }

  /**
   * 提交评分
   */
  rate(args: { modelId: string; provider: string; userId: string; userName: string; score: number; review: string }): ModelRating {
    if (args.score < 1 || args.score > 5) {
      throw new Error('score 必须在 1-5')
    }
    if (!args.modelId || !args.provider) {
      throw new Error('modelId 和 provider 必填')
    }
    const r: ModelRating = {
      id: `rating-${randomUUID().slice(0, 8)}`,
      modelId: args.modelId,
      provider: args.provider,
      userId: args.userId,
      userName: args.userName,
      score: args.score,
      review: args.review,
      createdAt: Date.now(),
    }
    this.ratings.push(r)
    this.persist()
    void this.bus.publish('model:rated', { modelId: args.modelId, score: args.score })
    this.log.info(`ModelRatingManager: ${args.modelId} 评分 ${args.score}★`)
    return r
  }

  /**
   * 列出某模型的所有评分
   */
  listForModel(modelId: string): ModelRating[] {
    return this.ratings.filter((r) => r.modelId === modelId)
  }

  /**
   * 全量统计(按 modelId 聚合)
   * 用于 P1-07 性价比对比
   */
  getStats(): ModelStats[] {
    const map = new Map<string, ModelStats>()
    for (const r of this.ratings) {
      const key = `${r.provider}::${r.modelId}`
      let s = map.get(key)
      if (!s) {
        s = { modelId: r.modelId, provider: r.provider, ratingSum: 0, ratingCount: 0, avgScore: 0 }
        map.set(key, s)
      }
      s.ratingSum += r.score
      s.ratingCount += 1
    }
    // 计算 avg
    for (const s of map.values()) {
      s.avgScore = s.ratingCount > 0 ? s.ratingSum / s.ratingCount : 0
    }
    return [...map.values()]
  }

  /**
   * 全量评分(给模型对比用)
   */
  listAll(): ModelRating[] {
    return [...this.ratings]
  }

  /**
   * 清空(测试用)
   */
  clear(): void {
    this.ratings = []
    this.persist()
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.ratings, null, 2))
    } catch (e) {
      this.log.warn('ModelRatingManager: persist failed', e)
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        this.ratings = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
      this.log.info(`ModelRatingManager: 加载 ${this.ratings.length} 评分`)
    } catch (e) {
      this.log.warn('ModelRatingManager: load failed', e)
    }
  }
}
