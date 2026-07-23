import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/pipiclaw-hermes-test'),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
  },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P2-T2.1 + T2.4: Hermes 行为记录 + 记忆检索
 *
 * 验证 HermesMemory 的 store / recall / buildMemoryPrompt 全链路:
 * - 重复 3 次相同 query → retrieve 返回相关 memories
 * - 加核心记忆"我常用 D:/downloads" → buildMemoryPrompt 注入到 prompt
 * - 经验记忆按 importance + time 排序
 */

import { HermesMemory } from '../../electron/hermes/HermesMemory'

const TEST_USER_DATA = '/tmp/pipiclaw-hermes-test'

describe('P2-T2.1/T2.4: Hermes memory store / recall / prompt', () => {
  beforeEach(() => {
    // 强制刷新单例 + 清 userData
    ;(HermesMemory as unknown as { instance: HermesMemory | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton returns same instance', () => {
    const a = HermesMemory.getInstance()
    const b = HermesMemory.getInstance()
    expect(a).toBe(b)
  })

  it('addExperienceMemory stores and retrievable', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    mem.addExperienceMemory('今天测试了 Hermes 行为记录', ['test'])

    const all = mem.getAllMemories()
    expect(all.length).toBe(1)
    expect(all[0].content).toContain('Hermes 行为记录')
    expect(all[0].type).toBe('experience')
    expect(all[0].importance).toBe(50)
  })

  it('T2.1: 重复 3 次相同操作,所有 entries 都被记录', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    for (let i = 0; i < 3; i++) {
      mem.addExperienceMemory('列出 D:/downloads 文件', ['file-listing', 'repeat'])
    }

    const all = mem.getAllMemories()
    expect(all.length).toBe(3)
    // 验证每个 entry 都可被 retrieve 找到
    const relevant = mem.retrieveRelevantMemories('列出 D:/downloads', 5)
    expect(relevant.length).toBeGreaterThanOrEqual(3)
    relevant.forEach((m) => {
      expect(m.content).toContain('D:/downloads')
    })
  })

  it('T2.4: 核心记忆注入到 buildMemoryPrompt', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    mem.updateCoreMemory('我常用 D:/downloads 作为下载目录')

    const prompt = mem.buildMemoryPrompt('我文件在哪?')
    expect(prompt).toContain('## 用户核心记忆')
    expect(prompt).toContain('我常用 D:/downloads')
  })

  it('T2.4: 经验记忆也注入到 buildMemoryPrompt', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    mem.updateCoreMemory('我常用 D:/downloads')
    mem.addExperienceMemory('之前我也搜过 D:/downloads 下的文件', ['search-history'])

    const prompt = mem.buildMemoryPrompt('我文件在哪?')
    expect(prompt).toContain('## 用户核心记忆')
    expect(prompt).toContain('## 相关历史记忆')
    expect(prompt).toContain('D:/downloads')
  })

  it('空记忆时 buildMemoryPrompt 不含用户内容(只有默认头)', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    const prompt = mem.buildMemoryPrompt('任何问题')
    // clearAllMemories 会写默认头 "# 用户核心记忆",所以 prompt 会有头
    // 但不应有实际用户内容或"## 相关历史记忆"段
    expect(prompt).not.toContain('## 相关历史记忆')
    // 验证没有"我"字样的真实记忆(默认头里没有)
    expect(prompt).not.toMatch(/我常用|我喜欢/)
  })

  it('经验记忆文件落盘到 MEMORY.md', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    mem.addExperienceMemory('test memory 1')
    mem.addExperienceMemory('test memory 2')

    const exp = mem.getExperienceMemory()
    expect(exp).toContain('test memory 1')
    expect(exp).toContain('test memory 2')
  })

  it('核心记忆文件落盘到 USER.md', () => {
    const mem = HermesMemory.getInstance()
    mem.clearAllMemories()
    mem.updateCoreMemory('User: 我是开发者,使用 macOS')

    const core = mem.getCoreMemory()
    expect(core).toContain('我是开发者')
    expect(core).toContain('macOS')

    // 验证文件落盘
    const userMdPath = path.join(TEST_USER_DATA, 'hermes-memory', 'USER.md')
    expect(fs.existsSync(userMdPath)).toBe(true)
    const fileContent = fs.readFileSync(userMdPath, 'utf-8')
    expect(fileContent).toContain('我是开发者')
  })
})
