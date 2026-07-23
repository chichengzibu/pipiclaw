/**
 * PiPiClaw - ClawHub 技能市场管理器 (P1-03/04/05/06)
 *
 * 4 个子能力:
 * 1. publish(skill) — 用户发布技能,状态=pending
 * 2. review(skillId, approve, reason?) — 管理员审核
 * 3. search(query, filters) — 关键词 + 标签 + 分类搜索
 * 4. rate(skillId, score, review) — 用户评分(1-5 星)+ 短评
 *
 * 存储:userData/clawhub-skills.json(本地模拟云端)
 * 单例 + IPC 暴露
 *
 * 安全策略:
 *  - 审核通过才能被 search 看到
 *  - 评分 1-5,带 IP 限频(本地版不实装)
 *  - skill 来源分类(builtin / community / private)
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

export type ClawHubStatus = 'pending' | 'approved' | 'rejected' | 'flagged'

export interface ClawHubSkill {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  /** 技能内容(完整 skill.md + 文件) */
  manifestPath: string
  /** 作者 */
  authorId: string
  authorName: string
  /** 状态 */
  status: ClawHubStatus
  /** 审核信息 */
  reviewedBy?: string
  reviewedAt?: number
  rejectReason?: string
  /** 统计 */
  downloadCount: number
  ratingSum: number
  ratingCount: number
  /** 时间戳 */
  publishedAt: number
  updatedAt: number
  /** 分类 */
  source: 'community' | 'private' | 'builtin'
}

export interface ClawHubReview {
  id: string
  skillId: string
  userId: string
  userName: string
  /** 1-5 星 */
  score: number
  /** 短评文字 */
  review: string
  createdAt: number
}

export class ClawHubManager {
  private static instance: ClawHubManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private skillsPath: string
  private reviewsPath: string
  private skills: Map<string, ClawHubSkill> = new Map()
  private reviews: Map<string, ClawHubReview[]> = new Map()

  private constructor() {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
    this.skillsPath = path.join(userData, 'clawhub-skills.json')
    this.reviewsPath = path.join(userData, 'clawhub-reviews.json')
    this.load()
  }

  public static getInstance(): ClawHubManager {
    if (!ClawHubManager.instance) ClawHubManager.instance = new ClawHubManager()
    return ClawHubManager.instance
  }

  // ==================== 1. 发布 ====================
  publish(args: {
    name: string
    description: string
    category: string
    tags: string[]
    manifestPath: string
    authorId: string
    authorName: string
    source?: 'community' | 'private'
  }): ClawHubSkill {
    if (!args.name || !args.description) {
      throw new Error('name 和 description 必填')
    }
    const now = Date.now()
    const skill: ClawHubSkill = {
      id: `skill-${randomUUID().slice(0, 8)}`,
      name: args.name,
      description: args.description,
      category: args.category || 'uncategorized',
      tags: args.tags || [],
      manifestPath: args.manifestPath,
      authorId: args.authorId,
      authorName: args.authorName,
      status: 'pending',
      downloadCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      publishedAt: now,
      updatedAt: now,
      source: args.source || 'community',
    }
    this.skills.set(skill.id, skill)
    this.persist()
    void this.bus.publish('clawhub:published', { id: skill.id, name: skill.name })
    this.log.info(`ClawHubManager: 已发布 ${skill.id} (${skill.name}),状态 pending`)
    return skill
  }

  // ==================== 2. 审核 ====================
  review(skillId: string, approve: boolean, reviewerId: string, reason?: string): ClawHubSkill | null {
    const skill = this.skills.get(skillId)
    if (!skill) return null
    if (skill.status === 'approved' && !approve) {
      // 已通过又驳回,允许
    }
    skill.status = approve ? 'approved' : 'rejected'
    skill.reviewedBy = reviewerId
    skill.reviewedAt = Date.now()
    skill.rejectReason = approve ? undefined : reason || 'no reason given'
    skill.updatedAt = Date.now()
    this.persist()
    void this.bus.publish('clawhub:reviewed', { id: skillId, status: skill.status })
    this.log.info(`ClawHubManager: ${skillId} → ${skill.status}`)
    return skill
  }

  // ==================== 3. 搜索 ====================
  search(opts: {
    query?: string
    category?: string
    tag?: string
    status?: ClawHubStatus
    sortBy?: 'downloads' | 'rating' | 'recent'
  } = {}): ClawHubSkill[] {
    let results = [...this.skills.values()]
    // 默认只展示已审核通过的(非 approved 不进公开列表)
    const status = opts.status ?? 'approved'
    results = results.filter((s) => s.status === status)
    if (opts.query) {
      const q = opts.query.toLowerCase()
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    if (opts.category) results = results.filter((s) => s.category === opts.category)
    if (opts.tag) results = results.filter((s) => s.tags.includes(opts.tag!))

    // 排序
    const sortBy = opts.sortBy ?? 'recent'
    if (sortBy === 'downloads') {
      results.sort((a, b) => b.downloadCount - a.downloadCount)
    } else if (sortBy === 'rating') {
      results.sort((a, b) => this.avgRating(b) - this.avgRating(a))
    } else {
      results.sort((a, b) => b.publishedAt - a.publishedAt)
    }
    return results
  }

  // ==================== 4. 评分 ====================
  rate(args: {
    skillId: string
    userId: string
    userName: string
    score: number
    review: string
  }): ClawHubReview | null {
    const skill = this.skills.get(args.skillId)
    if (!skill) return null
    if (args.score < 1 || args.score > 5) {
      throw new Error('score 必须在 1-5')
    }
    const r: ClawHubReview = {
      id: `rev-${randomUUID().slice(0, 8)}`,
      skillId: args.skillId,
      userId: args.userId,
      userName: args.userName,
      score: args.score,
      review: args.review,
      createdAt: Date.now(),
    }
    const list = this.reviews.get(args.skillId) ?? []
    list.push(r)
    this.reviews.set(args.skillId, list)
    skill.ratingSum += args.score
    skill.ratingCount += 1
    skill.updatedAt = Date.now()
    this.persist()
    void this.bus.publish('clawhub:rated', { skillId: args.skillId, score: args.score })
    return r
  }

  // ==================== 工具方法 ====================
  get(id: string): ClawHubSkill | null {
    return this.skills.get(id) ?? null
  }

  list(): ClawHubSkill[] {
    return [...this.skills.values()]
  }

  listPending(): ClawHubSkill[] {
    return [...this.skills.values()].filter((s) => s.status === 'pending')
  }

  listReviews(skillId: string): ClawHubReview[] {
    return [...(this.reviews.get(skillId) ?? [])]
  }

  avgRating(skill: ClawHubSkill): number {
    return skill.ratingCount > 0 ? skill.ratingSum / skill.ratingCount : 0
  }

  incrementDownload(skillId: string): void {
    const skill = this.skills.get(skillId)
    if (skill) {
      skill.downloadCount += 1
      this.persist()
    }
  }

  // ==================== 持久化 ====================
  private persist(): void {
    try {
      fs.writeFileSync(this.skillsPath, JSON.stringify([...this.skills.values()], null, 2))
      const reviewsObj: Record<string, ClawHubReview[]> = {}
      for (const [k, v] of this.reviews) reviewsObj[k] = v
      fs.writeFileSync(this.reviewsPath, JSON.stringify(reviewsObj, null, 2))
    } catch (e) {
      this.log.warn('ClawHubManager: persist failed', e)
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.skillsPath)) {
        const arr = JSON.parse(fs.readFileSync(this.skillsPath, 'utf-8')) as ClawHubSkill[]
        for (const s of arr) this.skills.set(s.id, s)
      }
      if (fs.existsSync(this.reviewsPath)) {
        const obj = JSON.parse(fs.readFileSync(this.reviewsPath, 'utf-8')) as Record<string, ClawHubReview[]>
        for (const [k, v] of Object.entries(obj)) this.reviews.set(k, v)
      }
      this.log.info(`ClawHubManager: 加载 ${this.skills.size} skills, ${this.reviews.size} review buckets`)
    } catch (e) {
      this.log.warn('ClawHubManager: load failed', e)
    }
  }
}
