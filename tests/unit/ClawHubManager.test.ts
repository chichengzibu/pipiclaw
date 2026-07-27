import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-clawhub-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P1-03/04/05/06: ClawHub 技能市场
 *
 * 验证 ClawHubManager 4 个能力:
 * - publish (P1-03)
 * - review (P1-04)
 * - search (P1-05)
 * - rate (P1-06)
 */

import { ClawHubManager } from '../../electron/skill/ClawHubManager'

const TEST_USER_DATA = '/tmp/pipiclaw-clawhub-test'

describe('P1-03: ClawHubManager.publish', () => {
  beforeEach(() => {
    ;(ClawHubManager as unknown as { instance: ClawHubManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton', () => {
    const a = ClawHubManager.getInstance()
    const b = ClawHubManager.getInstance()
    expect(a).toBe(b)
  })

  it('publish 后默认状态 pending', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 'Test Skill',
      description: 'A test skill',
      category: 'productivity',
      tags: ['test'],
      manifestPath: '/path/to/skill.md',
      authorId: 'u1',
      authorName: 'Alice',
    })
    expect(skill.id).toMatch(/^skill-/)
    expect(skill.status).toBe('pending')
    expect(skill.name).toBe('Test Skill')
    expect(skill.tags).toEqual(['test'])
  })

  it('name 缺 → 抛错', () => {
    const mgr = ClawHubManager.getInstance()
    expect(() =>
      mgr.publish({
        name: '',
        description: 'x',
        category: 'c',
        tags: [],
        manifestPath: '/p',
        authorId: 'u',
        authorName: 'n',
      }),
    ).toThrow(/name.*必填/)
  })

  it('description 缺 → 抛错', () => {
    const mgr = ClawHubManager.getInstance()
    expect(() =>
      mgr.publish({
        name: 'x',
        description: '',
        category: 'c',
        tags: [],
        manifestPath: '/p',
        authorId: 'u',
        authorName: 'n',
      }),
    ).toThrow(/name 和 description 必填/)
  })

  it('持久化到 userData/clawhub-skills.json', () => {
    const mgr = ClawHubManager.getInstance()
    mgr.publish({
      name: 'persist-test',
      description: 'd',
      category: 'c',
      tags: [],
      manifestPath: '/p',
      authorId: 'u',
      authorName: 'n',
    })
    const filePath = `${TEST_USER_DATA}/clawhub-skills.json`
    expect(fs.existsSync(filePath)).toBe(true)
    const arr = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    expect(arr.length).toBe(1)
    expect(arr[0].name).toBe('persist-test')
  })
})

describe('P1-04: ClawHubManager.review', () => {
  beforeEach(() => {
    ;(ClawHubManager as unknown as { instance: ClawHubManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('approve → status approved + reviewedBy/at 填上', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    const reviewed = mgr.review(skill.id, true, 'admin-1')
    expect(reviewed?.status).toBe('approved')
    expect(reviewed?.reviewedBy).toBe('admin-1')
    expect(reviewed?.reviewedAt).toBeGreaterThan(0)
  })

  it('reject → status rejected + rejectReason', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    const reviewed = mgr.review(skill.id, false, 'admin-1', 'has malware')
    expect(reviewed?.status).toBe('rejected')
    expect(reviewed?.rejectReason).toBe('has malware')
  })

  it('reject 不传 reason → 默认 "no reason given"', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    const reviewed = mgr.review(skill.id, false, 'admin')
    expect(reviewed?.rejectReason).toBe('no reason given')
  })

  it('不存在的 id → null', () => {
    const mgr = ClawHubManager.getInstance()
    expect(mgr.review('nonexistent', true, 'admin')).toBeNull()
  })
})

describe('P1-05: ClawHubManager.search', () => {
  beforeEach(() => {
    ;(ClawHubManager as unknown as { instance: ClawHubManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  function seed() {
    const mgr = ClawHubManager.getInstance()
    const a = mgr.publish({ name: 'Code Review', description: 'review code', category: 'dev', tags: ['code', 'review'], manifestPath: '/p', authorId: 'u1', authorName: 'A' })
    const b = mgr.publish({ name: 'Test Generator', description: 'gen tests', category: 'dev', tags: ['test'], manifestPath: '/p', authorId: 'u2', authorName: 'B' })
    const c = mgr.publish({ name: 'File Sort', description: 'sort files', category: 'productivity', tags: ['file'], manifestPath: '/p', authorId: 'u3', authorName: 'C' })
    mgr.review(a.id, true, 'admin')
    mgr.review(b.id, true, 'admin')
    // c 留 pending
    return { a, b, c }
  }

  it('默认只显示 approved', () => {
    seed()
    const mgr = ClawHubManager.getInstance()
    const results = mgr.search()
    expect(results.length).toBe(2)
    expect(results.every((s) => s.status === 'approved')).toBe(true)
  })

  it('status:pending 看 listPending', () => {
    seed()
    const mgr = ClawHubManager.getInstance()
    const pending = mgr.listPending()
    expect(pending.length).toBe(1)
    expect(pending[0].name).toBe('File Sort')
  })

  it('query 匹配 name/description/tags', () => {
    seed()
    const mgr = ClawHubManager.getInstance()
    expect(mgr.search({ query: 'review' }).length).toBe(1)
    expect(mgr.search({ query: 'test' }).length).toBe(1) // Test Generator
    expect(mgr.search({ query: 'code' }).length).toBe(1) // tags match
    expect(mgr.search({ query: 'nope' }).length).toBe(0)
  })

  it('category 过滤', () => {
    seed()
    const mgr = ClawHubManager.getInstance()
    expect(mgr.search({ category: 'dev' }).length).toBe(2)
    expect(mgr.search({ category: 'productivity' }).length).toBe(0) // pending 不显示
  })

  it('tag 过滤', () => {
    seed()
    const mgr = ClawHubManager.getInstance()
    expect(mgr.search({ tag: 'review' }).length).toBe(1)
  })

  it('sortBy: downloads / rating / recent', () => {
    const { a, b } = seed()
    const mgr = ClawHubManager.getInstance()
    // 给 a 3 次下载,b 1 次
    mgr.incrementDownload(a.id); mgr.incrementDownload(a.id); mgr.incrementDownload(a.id)
    mgr.incrementDownload(b.id)
    const byDl = mgr.search({ sortBy: 'downloads' })
    expect(byDl[0].id).toBe(a.id)
    // 给 b 5 星
    mgr.rate({ skillId: b.id, userId: 'u', userName: 'r', score: 5, review: '' })
    const byRating = mgr.search({ sortBy: 'rating' })
    expect(byRating[0].id).toBe(b.id)
  })
})

describe('P1-06: ClawHubManager.rate', () => {
  beforeEach(() => {
    ;(ClawHubManager as unknown as { instance: ClawHubManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('rate 1-5 星', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.review(skill.id, true, 'admin')
    const r = mgr.rate({ skillId: skill.id, userId: 'u1', userName: 'Alice', score: 5, review: 'great' })
    expect(r?.score).toBe(5)
    expect(skill.ratingSum).toBe(5)
    expect(skill.ratingCount).toBe(1)
    expect(mgr.avgRating(skill)).toBe(5)
  })

  it('多次评分 → 平均分', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.rate({ skillId: skill.id, userId: 'u1', userName: 'a', score: 5, review: '' })
    mgr.rate({ skillId: skill.id, userId: 'u2', userName: 'b', score: 3, review: '' })
    mgr.rate({ skillId: skill.id, userId: 'u3', userName: 'c', score: 4, review: '' })
    expect(mgr.avgRating(skill)).toBe(4)
  })

  it('score < 1 → 抛错', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    expect(() =>
      mgr.rate({ skillId: skill.id, userId: 'u', userName: 'n', score: 0, review: '' }),
    ).toThrow(/score 必须在 1-5/)
  })

  it('score > 5 → 抛错', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    expect(() =>
      mgr.rate({ skillId: skill.id, userId: 'u', userName: 'n', score: 6, review: '' }),
    ).toThrow(/score 必须在 1-5/)
  })

  it('不存在的 skillId → null', () => {
    const mgr = ClawHubManager.getInstance()
    expect(mgr.rate({ skillId: 'nope', userId: 'u', userName: 'n', score: 5, review: '' })).toBeNull()
  })

  it('listReviews 返回该 skill 的所有评价', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.rate({ skillId: skill.id, userId: 'u1', userName: 'a', score: 5, review: 'good' })
    mgr.rate({ skillId: skill.id, userId: 'u2', userName: 'b', score: 3, review: 'ok' })
    const reviews = mgr.listReviews(skill.id)
    expect(reviews.length).toBe(2)
    expect(reviews[0].review).toBe('good')
  })

  it('incrementDownload 计数', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.incrementDownload(skill.id)
    mgr.incrementDownload(skill.id)
    expect(mgr.get(skill.id)?.downloadCount).toBe(2)
  })
})

describe('P3-05: ClawHubManager 多维评分', () => {
  beforeEach(() => {
    ;(ClawHubManager as unknown as { instance: ClawHubManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('rate 支持多维评分 (usability/perf/security)', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.review(skill.id, true, 'admin')
    const r = mgr.rate({
      skillId: skill.id, userId: 'u1', userName: 'Alice', score: 5,
      review: 'great', usability: 5, performance: 4, security: 5,
    })
    expect(r?.usability).toBe(5)
    expect(r?.performance).toBe(4)
    expect(r?.security).toBe(5)
    const s = mgr.get(skill.id)!
    expect(s.usabilitySum).toBe(5)
    expect(s.usabilityCount).toBe(1)
    expect(s.performanceSum).toBe(4)
    expect(s.performanceCount).toBe(1)
    expect(s.securitySum).toBe(5)
    expect(s.securityCount).toBe(1)
  })

  it('rate 多维评分允许 0/undefined (视为未评该维度)', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.review(skill.id, true, 'admin')
    const r = mgr.rate({
      skillId: skill.id, userId: 'u1', userName: 'Alice', score: 4,
      review: 'good', usability: 5, // performance/security 缺失
    })
    expect(r?.usability).toBe(5)
    expect(r?.performance).toBeUndefined()
    expect(r?.security).toBeUndefined()
    const s = mgr.get(skill.id)!
    expect(s.usabilityCount).toBe(1)
    expect(s.performanceCount).toBe(0) // 未计
    expect(s.securityCount).toBe(0)
  })

  it('rate 多维评分越界 1-5 抛错', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.review(skill.id, true, 'admin')
    expect(() =>
      mgr.rate({
        skillId: skill.id, userId: 'u1', userName: 'A', score: 4, review: 'x', usability: 7,
      })
    ).toThrow(/usability 必须在 1-5/)
  })

  it('computeRatingBreakdown 返回多维快照', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    mgr.review(skill.id, true, 'admin')
    mgr.rate({ skillId: skill.id, userId: 'u1', userName: 'A', score: 4, review: 'x', usability: 5, performance: 3 })
    mgr.rate({ skillId: skill.id, userId: 'u2', userName: 'B', score: 5, review: 'y', usability: 4, security: 5 })
    const breakdown = mgr.getRatingBreakdown(skill.id)!
    expect(breakdown.overall).toBe(4.5) // (4+5)/2
    expect(breakdown.usability).toBe(4.5) // (5+4)/2
    expect(breakdown.performance).toBe(3) // 单评
    expect(breakdown.security).toBe(5) // 单评
    expect(breakdown.total).toBe(2)
  })

  it('computeRatingBreakdown 无评分时 overall=0 / 维度=null', () => {
    const mgr = ClawHubManager.getInstance()
    const skill = mgr.publish({
      name: 't', description: 'd', category: 'c', tags: [], manifestPath: '/p', authorId: 'u', authorName: 'n',
    })
    const breakdown = mgr.getRatingBreakdown(skill.id)!
    expect(breakdown.overall).toBe(0)
    expect(breakdown.usability).toBeNull()
    expect(breakdown.performance).toBeNull()
    expect(breakdown.security).toBeNull()
    expect(breakdown.total).toBe(0)
  })
})

describe('P2-03: ClawHubManager 技能模板', () => {
  beforeEach(() => {
    ;(ClawHubManager as unknown as { instance: ClawHubManager | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('listTemplates 至少 5 个内置模板', () => {
    const mgr = ClawHubManager.getInstance()
    const tpls = mgr.listTemplates()
    expect(tpls.length).toBeGreaterThanOrEqual(5)
  })

  it('listTemplateCategories 返回唯一分类列表', () => {
    const mgr = ClawHubManager.getInstance()
    const cats = mgr.listTemplateCategories()
    expect(cats.length).toBeGreaterThanOrEqual(2)
    expect(new Set(cats).size).toBe(cats.length) // 去重
  })

  it('getTemplate 存在 → 返回模板', () => {
    const mgr = ClawHubManager.getInstance()
    const tpl = mgr.listTemplates()[0]
    expect(mgr.getTemplate(tpl.id)?.id).toBe(tpl.id)
  })

  it('getTemplate 不存在 → null', () => {
    const mgr = ClawHubManager.getInstance()
    expect(mgr.getTemplate('tpl-ghost')).toBeNull()
  })

  it('listTemplates 按 query 过滤(名称)', () => {
    const mgr = ClawHubManager.getInstance()
    const all = mgr.listTemplates()
    const tplName = all[0].name
    const filtered = mgr.listTemplates({ query: tplName })
    expect(filtered.length).toBeGreaterThanOrEqual(1)
    expect(filtered[0].name).toBe(tplName)
  })

  it('listTemplates 按 query 过滤(标签)', () => {
    const mgr = ClawHubManager.getInstance()
    const all = mgr.listTemplates()
    const tag = all[0].tags[0]
    const filtered = mgr.listTemplates({ query: tag })
    expect(filtered.length).toBeGreaterThanOrEqual(1)
  })

  it('listTemplates 按 category 过滤', () => {
    const mgr = ClawHubManager.getInstance()
    const all = mgr.listTemplates()
    const cat = all[0].category
    const filtered = mgr.listTemplates({ category: cat })
    expect(filtered.every((t) => t.category === cat)).toBe(true)
  })

  it('instantiateTemplate → 创建新 skill (pending) + 模板内容写入文件', () => {
    const mgr = ClawHubManager.getInstance()
    const tpl = mgr.listTemplates()[0]
    const skill = mgr.instantiateTemplate({
      templateId: tpl.id,
      customName: '我的日报',
      authorId: 'u1',
      authorName: '测试用户',
    })
    expect(skill.source).toBe('template')
    expect(skill.templateId).toBe(tpl.id)
    expect(skill.name).toBe('我的日报')
    expect(skill.status).toBe('pending')
    expect(skill.category).toBe(tpl.category)
    expect(skill.tags).toEqual(tpl.tags)
    // 文件写入了
    expect(fs.existsSync(skill.manifestPath)).toBe(true)
    const content = fs.readFileSync(skill.manifestPath, 'utf-8')
    expect(content).toBe(tpl.manifestContent)
  })

  it('instantiateTemplate 不指定 customName → 默认 "<模板名> (我的副本)"', () => {
    const mgr = ClawHubManager.getInstance()
    const tpl = mgr.listTemplates()[0]
    const skill = mgr.instantiateTemplate({
      templateId: tpl.id,
      authorId: 'u1',
      authorName: 'u',
    })
    expect(skill.name).toBe(`${tpl.name} (我的副本)`)
  })

  it('instantiateTemplate 不存在的 templateId → 抛错', () => {
    const mgr = ClawHubManager.getInstance()
    expect(() =>
      mgr.instantiateTemplate({ templateId: 'tpl-ghost', authorId: 'u', authorName: 'n' }),
    ).toThrow(/不存在/)
  })

  it('实例化后的 skill 默认不在 search 结果中(状态 pending)', () => {
    const mgr = ClawHubManager.getInstance()
    const tpl = mgr.listTemplates()[0]
    const skill = mgr.instantiateTemplate({
      templateId: tpl.id,
      authorId: 'u1',
      authorName: 'u',
    })
    const approved = mgr.search({ status: 'approved' })
    expect(approved.find((s) => s.id === skill.id)).toBeUndefined()
    const pending = mgr.listPending()
    expect(pending.find((s) => s.id === skill.id)).toBeDefined()
  })

  it('多次实例化同一模板 → 多个独立 skill + 各自 manifest 文件', () => {
    const mgr = ClawHubManager.getInstance()
    const tpl = mgr.listTemplates()[0]
    const s1 = mgr.instantiateTemplate({ templateId: tpl.id, authorId: 'a', authorName: 'A' })
    const s2 = mgr.instantiateTemplate({ templateId: tpl.id, authorId: 'b', authorName: 'B' })
    expect(s1.id).not.toBe(s2.id)
    expect(s1.manifestPath).not.toBe(s2.manifestPath)
    expect(fs.existsSync(s1.manifestPath)).toBe(true)
    expect(fs.existsSync(s2.manifestPath)).toBe(true)
  })

  it('实例化后审核通过 → 进 search 列表', () => {
    const mgr = ClawHubManager.getInstance()
    const tpl = mgr.listTemplates()[0]
    const skill = mgr.instantiateTemplate({ templateId: tpl.id, authorId: 'u', authorName: 'n' })
    mgr.review(skill.id, true, 'admin')
    const approved = mgr.search({ status: 'approved' })
    expect(approved.find((s) => s.id === skill.id)).toBeDefined()
  })
})
