import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/pipiclaw-selflearner-test'),
    // SelfLearner writes to getAppPath() + '/../skills'
    // We want that to resolve to getPath('userData') + '/skills'
    // = /tmp/pipiclaw-selflearner-test/skills
    // so getAppPath() needs to be a subpath: /tmp/pipiclaw-selflearner-test/x
    // then path.join(x, '..', 'skills') = /tmp/pipiclaw-selflearner-test/skills
    getAppPath: vi.fn(() => '/tmp/pipiclaw-selflearner-test/app'),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
  },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P2-T2.1 + T2.2 + T2.3: Hermes 自我学习 + 技能自动生成 + 热加载
 *
 * 验证 SelfLearner 的核心链路:
 * - T2.1: 观察执行 → 3 次不同指令 → 记录到 observations
 * - T2.2: 手动构造 SkillProposal → saveSkillFromProposal 落盘 skill.md
 * - T2.3: saveSkillFromProposal 后 SkillLoader.reloadSkills 立即可查
 */

import { SelfLearner } from '../../electron/learning/SelfLearner'
import { SkillLoader } from '../../electron/skill/SkillLoader'
import type { SkillProposal } from '../../electron/learning/SelfLearner'

const TEST_USER_DATA = '/tmp/pipiclaw-selflearner-test'
// SelfLearner.saveSkillFromProposal 写入 path.join(getAppPath(), '..', 'skills')
// + SkillManager.getSkillsDir() = path.join(getPath('userData'), 'skills')
// mock 让两者解析到同一目录:/tmp/pipiclaw-selflearner-test/skills
const SKILLS_DIR = path.join(TEST_USER_DATA, 'skills')

describe('P2-T2.1: SelfLearner observeExecution records patterns', () => {
  beforeEach(() => {
    // 重置单例 + 清 userData
    ;(SelfLearner as unknown as { instance: SelfLearner | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton returns same instance', () => {
    const a = SelfLearner.getInstance()
    const b = SelfLearner.getInstance()
    expect(a).toBe(b)
  })

  it('T2.1: 3 次不同观察记录都被记入 observations', () => {
    const learner = SelfLearner.getInstance()
    learner.resetStats()

    // 3 个不同的"用户操作"模式
    learner.observeExecution('列出 D:/downloads 文件', [{ type: 'list' }], { ok: true })
    learner.observeExecution('删除 D:/downloads 中旧文件', [{ type: 'delete' }], { ok: true })
    learner.observeExecution('压缩 D:/downloads', [{ type: 'compress' }], { ok: true })

    const stats = learner.getStats()
    expect(stats.observationCount).toBe(3)
  })

  it('T2.1: 重复指令被去重(同一个 instruction 只算一次)', () => {
    const learner = SelfLearner.getInstance()
    learner.resetStats()

    learner.observeExecution('同样的指令', [{ type: 'x' }], { ok: true })
    learner.observeExecution('同样的指令', [{ type: 'x' }], { ok: true })
    learner.observeExecution('同样的指令', [{ type: 'x' }], { ok: true })

    const stats = learner.getStats()
    expect(stats.observationCount).toBe(1) // 重复的跳过
  })

  it('T2.1: 超过 10 条观察自动截断到最近 10', () => {
    const learner = SelfLearner.getInstance()
    learner.resetStats()

    for (let i = 0; i < 15; i++) {
      learner.observeExecution(`unique instruction ${i}`, [{ type: 'x' }], { ok: true })
    }

    const stats = learner.getStats()
    expect(stats.observationCount).toBe(10)
  })

  it('T2.1: getPendingProposal 初始为 null', () => {
    const learner = SelfLearner.getInstance()
    learner.resetStats()
    // 清掉可能残留的 proposal
    learner.clearPendingProposal()
    expect(learner.getPendingProposal()).toBeNull()
  })
})

describe('P2-T2.2: saveSkillFromProposal 落盘 skill.md', () => {
  beforeEach(() => {
    ;(SelfLearner as unknown as { instance: SelfLearner | null }).instance = null
    ;(SkillLoader as unknown as { instance: SkillLoader | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
    // /tmp/skills 是 SelfLearner.saveSkillFromProposal 真实写入路径
    if (fs.existsSync(SKILLS_DIR)) {
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true })
    }
  })

  function makeProposal(): SkillProposal {
    return {
      id: 'test-proposal-001',
      name: '文件列表助手',
      description: '列出指定目录下的文件',
      triggerCondition: '用户想列出某个目录的文件',
      keywords: ['列出', '文件', '目录'],
      operationSteps: ['读取目录', '过滤', '返回列表'],
      fullInstructions: '## 文件列表助手\n\n读取用户指定目录,返回文件列表',
      createdAt: Date.now(),
    }
  }

  it('T2.2: 保存 proposal → skills/<id>/skill.md 文件落盘', () => {
    const learner = SelfLearner.getInstance()
    const result = learner.saveSkillFromProposal(makeProposal())
    expect(result.success).toBe(true)

    // 验证 skill 目录创建
    expect(fs.existsSync(SKILLS_DIR)).toBe(true)
    const dirs = fs.readdirSync(SKILLS_DIR)
    expect(dirs.length).toBeGreaterThan(0)
    const firstDir = dirs[0]
    expect(firstDir).toMatch(/^test-proposal-001/)  // 含 id,可能带时间戳后缀

    // 验证 skill.md 落盘
    const skillMdPath = path.join(SKILLS_DIR, firstDir, 'skill.md')
    expect(fs.existsSync(skillMdPath)).toBe(true)
    // skill.md 只写 fullInstructions(包含 name + description + 步骤)
    const skillMd = fs.readFileSync(skillMdPath, 'utf-8')
    expect(skillMd).toContain('文件列表助手')
    expect(skillMd).toContain('读取用户指定目录')
  })

  it('T2.2: skill.md 包含 fullInstructions 完整内容', () => {
    const learner = SelfLearner.getInstance()
    learner.saveSkillFromProposal(makeProposal())

    const dirs = fs.readdirSync(SKILLS_DIR)
    const skillMd = fs.readFileSync(path.join(SKILLS_DIR, dirs[0], 'skill.md'), 'utf-8')
    // 完整写入 fullInstructions 字段
    expect(skillMd).toContain('## 文件列表助手')
    expect(skillMd).toContain('返回文件列表')
  })

  it('T2.2: saveSkillFromProposal 成功时清掉 pendingProposal', () => {
    const learner = SelfLearner.getInstance()
    const proposal = makeProposal()
    learner.saveSkillFromProposal(proposal)
    expect(learner.getPendingProposal()).toBeNull()
  })
})

describe('P2-T2.3: hot reload new skill', () => {
  beforeEach(() => {
    ;(SelfLearner as unknown as { instance: SelfLearner | null }).instance = null
    ;(SkillLoader as unknown as { instance: SkillLoader | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
    if (fs.existsSync(SKILLS_DIR)) {
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true })
    }
  })

  it('T2.3: 保存新 skill 后 SkillLoader.reloadSkills 立即可查', () => {
    // 1. 先初始化 SkillLoader(此时空)
    const loader1 = SkillLoader.getInstance()
    const initialCount = loader1.getAllSkills().length

    // 2. SelfLearner 保存一个 skill
    // skill.md 格式必须含 # name + ## 触发关键词 + ## 操作步骤 才能被 parseSkillMd 解析
    const learner = SelfLearner.getInstance()
    learner.saveSkillFromProposal({
      id: 'hot-reload-001',
      name: 'Hot Reload Test',
      description: '测试热加载',
      triggerCondition: 'hot reload',
      keywords: ['热加载', 'hot'],
      operationSteps: ['step1'],
      fullInstructions: `# Hot Reload Test

## 描述
测试热加载功能

## 触发关键词
- 热加载
- hot

## 操作步骤
1. 保存 skill
2. 验证 SkillLoader 立即可查
`,
      createdAt: Date.now(),
    })

    // 3. 强制 reload
    loader1.reloadSkills()
    const afterCount = loader1.getAllSkills().length

    // 4. 验证 skill 数 +1
    expect(afterCount).toBeGreaterThan(initialCount)
    const names = loader1.getAllSkills().map((s) => s.name)
    expect(names.some((n) => n.includes('Hot Reload'))).toBe(true)
  })
})
