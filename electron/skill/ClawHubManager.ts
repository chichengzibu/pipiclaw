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

/** 技能模板(P2-03):预置技能骨架,用户可一键实例化 */
export interface ClawHubTemplate {
  id: string
  /** 模板名(给用户看的) */
  name: string
  /** 模板描述 */
  description: string
  /** 适用场景 */
  useCase: string
  /** 分类 */
  category: string
  /** 标签 */
  tags: string[]
  /** 默认作者(团队名) */
  authorName: string
  /** 模板的 skill.md 内容 */
  manifestContent: string
  /** 创建时间 */
  createdAt: number
}

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
  source: 'community' | 'private' | 'builtin' | 'template'
  /** 如果是模板实例化产生的,记录源模板 id(P2-03) */
  templateId?: string
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
  private templates: Map<string, ClawHubTemplate> = new Map()

  private constructor() {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
    this.skillsPath = path.join(userData, 'clawhub-skills.json')
    this.reviewsPath = path.join(userData, 'clawhub-reviews.json')
    this.loadBuiltinTemplates()
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

  // ==================== P2-03 技能模板 ====================
  listTemplates(opts: { category?: string; query?: string } = {}): ClawHubTemplate[] {
    let results = [...this.templates.values()]
    if (opts.category) results = results.filter((t) => t.category === opts.category)
    if (opts.query) {
      const q = opts.query.toLowerCase()
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.useCase.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    return results
  }

  getTemplate(id: string): ClawHubTemplate | null {
    return this.templates.get(id) ?? null
  }

  listTemplateCategories(): string[] {
    const set = new Set<string>()
    for (const t of this.templates.values()) set.add(t.category)
    return [...set]
  }

  /** 从模板实例化一个新 skill(状态 pending,等待用户发布到 ClawHub) */
  instantiateTemplate(args: {
    templateId: string
    customName?: string
    authorId: string
    authorName: string
  }): ClawHubSkill {
    const tpl = this.templates.get(args.templateId)
    if (!tpl) {
      throw new Error(`template ${args.templateId} 不存在`)
    }
    const now = Date.now()
    const name = args.customName?.trim() || `${tpl.name} (我的副本)`
    // 把模板内容写到 userData/templates/<skill-id>/skill.md
    const userData = app.getPath('userData')
    const dir = path.join(userData, 'templates', `skill-${randomUUID().slice(0, 8)}`)
    fs.mkdirSync(dir, { recursive: true })
    const manifestPath = path.join(dir, 'skill.md')
    fs.writeFileSync(manifestPath, tpl.manifestContent, 'utf-8')
    const skill: ClawHubSkill = {
      id: `skill-${randomUUID().slice(0, 8)}`,
      name,
      description: tpl.description,
      category: tpl.category,
      tags: [...tpl.tags],
      manifestPath,
      authorId: args.authorId,
      authorName: args.authorName,
      status: 'pending',
      downloadCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      publishedAt: now,
      updatedAt: now,
      source: 'template',
      templateId: tpl.id,
    }
    this.skills.set(skill.id, skill)
    this.persist()
    void this.bus.publish('clawhub:template-instantiated', {
      skillId: skill.id,
      templateId: tpl.id,
      authorId: args.authorId,
    })
    this.log.info(
      `ClawHubManager: 从模板 ${tpl.id} 实例化 ${skill.id} (${skill.name}) → userData/templates/${path.basename(dir)}`,
    )
    return skill
  }

  private loadBuiltinTemplates(): void {
    const BUILTIN: ClawHubTemplate[] = [
      {
        id: 'tpl-daily-summary',
        name: '每日工作总结',
        description: '汇总今日聊天记录、任务进度,生成结构化日报',
        useCase: '每天下班前自动生成当日工作总结',
        category: 'productivity',
        tags: ['daily', 'summary', 'report'],
        authorName: 'PiPiClaw Team',
        manifestContent: `# 每日工作总结

## 描述
汇总今日 IM 聊天、任务、文件操作,生成结构化日报。

## 触发关键词
- 日报
- 今日总结
- 今天做了什么

## 操作步骤
1. 拉取今日 IM 消息(feishu/telegram/discord 等)
2. 汇总任务进度
3. 列出完成的文件操作
4. 输出 markdown 格式日报

## 输出格式
\`\`\`markdown
# YYYY-MM-DD 日报
## 完成任务
- ...
## 进行中
- ...
## 风险
- ...
\`\`\`
`,
        createdAt: Date.now(),
      },
      {
        id: 'tpl-code-review',
        name: '代码审查助手',
        description: '审查 PR diff,给出风格/安全/性能建议',
        useCase: '提交 PR 后自动 review 代码改动',
        category: 'developer',
        tags: ['code-review', 'pr', 'git'],
        authorName: 'PiPiClaw Team',
        manifestContent: `# 代码审查助手

## 描述
阅读 git diff,逐文件给出审查意见(风格/bug/安全/性能)。

## 触发关键词
- 帮我 review
- 审查代码
- code review

## 操作步骤
1. 读 git diff --staged
2. 按文件分组
3. 对每处改动给出:位置 / 类型(bug|style|perf|security) / 建议
4. 总结:approve / request changes

## 输出
- 整体评分(1-5)
- 必改项 / 建议项
`,
        createdAt: Date.now(),
      },
      {
        id: 'tpl-weekly-report',
        name: '周报生成器',
        description: '基于本周任务/IM 消息/代码 commit 自动生成周报',
        useCase: '每周五自动生成周报',
        category: 'productivity',
        tags: ['weekly', 'report', 'summary'],
        authorName: 'PiPiClaw Team',
        manifestContent: `# 周报生成器

## 描述
拉取本周完成任务、关键 IM 讨论、git commits,生成结构化周报。

## 触发关键词
- 周报
- 本周总结
- weekly report

## 操作步骤
1. 读取本周(周一到周日)任务状态
2. 汇总 IM 关键讨论
3. 列出本周代码 commit
4. 分类输出:亮点 / 进展 / 阻塞 / 下周计划

## 输出
- markdown 周报
- 一句话总结
`,
        createdAt: Date.now(),
      },
      {
        id: 'tpl-meeting-notes',
        name: '会议纪要生成',
        description: '会议录音/转写 → 结构化纪要 + 待办',
        useCase: '会议结束后自动生成纪要',
        category: 'productivity',
        tags: ['meeting', 'notes', 'minutes'],
        authorName: 'PiPiClaw Team',
        manifestContent: `# 会议纪要生成

## 描述
将会议转写文本整理为:议题 / 决议 / 待办 / 时间点。

## 触发关键词
- 会议纪要
- 总结会议
- meeting notes

## 操作步骤
1. 切分议题主旨
2. 提取关键决策
3. 提取待办事项(owner / deadline)
4. 标注关键时间点
`,
        createdAt: Date.now(),
      },
      {
        id: 'tpl-translate',
        name: '多语种翻译',
        description: '中英日韩法德西俄 8 语种互译,保留术语一致性',
        useCase: '文档/聊天/邮件快速翻译',
        category: 'language',
        tags: ['translate', 'i18n', 'multilingual'],
        authorName: 'PiPiClaw Team',
        manifestContent: `# 多语种翻译

## 描述
8 语种互译(中/英/日/韩/法/德/西/俄),保持术语表一致性。

## 触发关键词
- 翻译
- translate
- 翻成英文

## 操作步骤
1. 识别源语言
2. 检查术语表(项目特定术语优先)
3. 输出译文 + 关键术语对照
4. 提供 2-3 个备选表达

## 输出
- 主译文
- 备选
- 术语对照
`,
        createdAt: Date.now(),
      },
      {
        id: 'tpl-bug-triage',
        name: 'Bug 分流助手',
        description: '新 issue 自动分流:严重程度 / 模块归属 / 负责人',
        useCase: 'GitHub issue 提交流程',
        category: 'developer',
        tags: ['bug', 'triage', 'issue'],
        authorName: 'PiPiClaw Team',
        manifestContent: `# Bug 分流助手

## 描述
分析新提交的 bug issue,自动建议 severity / 归属模块 / 负责人。

## 触发关键词
- bug 分流
- 分流这个 issue
- bug triage

## 操作步骤
1. 读取 issue 标题 + 描述
2. 推断 severity(P0/P1/P2/P3)
3. 根据关键词归类模块(auth/payment/ui/...)
4. 根据 git blame 推荐负责人
5. 输出建议 + 标签
`,
        createdAt: Date.now(),
      },
    ]
    for (const t of BUILTIN) this.templates.set(t.id, t)
    this.log.info(`ClawHubManager: 加载 ${BUILTIN.length} 内置模板`)
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
