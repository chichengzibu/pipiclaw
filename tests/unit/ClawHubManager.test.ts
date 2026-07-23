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
