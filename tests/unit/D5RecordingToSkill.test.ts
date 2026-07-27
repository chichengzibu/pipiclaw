/**
 * P2-T3.3: D5RecordingToSkill 测试 (录屏 → skill.md)
 * 测试 LLM fallback 路径 + 基本流程编排 (无需真机屏幕)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-d5-test') },
}))

const mockVision = {
  isRecording: vi.fn(() => false),
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn().mockResolvedValue({
    frames: [
      { ts: 1000, dataUrl: 'data:image/png;base64,abc' },
      { ts: 2000, dataUrl: 'data:image/png;base64,def' },
    ],
    durationMs: 1000,
  }),
}

const mockCreator = {
  createSkill: vi.fn().mockResolvedValue({
    name: 'test-skill',
    description: 'd',
    content: '## 操作步骤\n1. xxx\nversion: 1.0.0',
  }),
  saveDraftToDisk: vi.fn().mockResolvedValue('/tmp/test/skill.md'),
}

const mockSigner = { sign: vi.fn() }
const mockVersioning = { record: vi.fn() }
const mockHermes = { importContext: vi.fn(() => '\n## 上下文\nxxx') }
const mockRuntime = { register: vi.fn() }

vi.mock('../../electron/computeruse/ScreenVision', () => ({
  ScreenVision: { getInstance: () => mockVision },
}))
vi.mock('../../electron/skill/AutoCreator', () => ({
  AutoCreator: { getInstance: () => mockCreator },
}))
vi.mock('../../electron/skill/SkillSigner', () => ({
  SkillSigner: { getInstance: () => mockSigner },
}))
vi.mock('../../electron/skill/SkillVersioning', () => ({
  SkillVersioning: { getInstance: () => mockVersioning },
}))
vi.mock('../../electron/skill/HermesImporter', () => ({
  HermesImporter: { getInstance: () => mockHermes },
}))
vi.mock('../../electron/runtime/skill/SkillRuntime', () => ({
  SkillRuntime: { getInstance: () => mockRuntime },
}))
vi.mock('../../electron/llm/LlmClient', () => ({
  LlmClient: {
    getInstance: () => ({
      complete: vi.fn().mockResolvedValue({ ok: false, error: 'no provider' }),
    }),
  },
}))

import { runD5 } from '../../electron/skill/builtin/D5RecordingToSkill'

describe('P2-T3.3: D5RecordingToSkill 录屏 → skill.md', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVision.isRecording.mockReturnValue(false)
    mockVision.stopRecording.mockResolvedValue({
      frames: [{ ts: 1000, dataUrl: 'a' }, { ts: 2000, dataUrl: 'b' }],
      durationMs: 1000,
    })
  })

  it('正在录制 → 拒绝生成 (避免冲突)', async () => {
    mockVision.isRecording.mockReturnValue(true)
    const r = await runD5({ triggerPhrase: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('请先停止')
  })

  it('录制 0 帧 → 返回明确错误', async () => {
    mockVision.stopRecording.mockResolvedValue({
      frames: [],
      durationMs: 100,
    })
    const r = await runD5({ triggerPhrase: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('0 帧')
  })

  it('完整流程: 录制 → 落盘 → 签名 → 注册', async () => {
    const r = await runD5({ triggerPhrase: '测试触发词', description: '测试描述' })
    expect(r.ok).toBe(true)
    expect(r.skillName).toBe('test-skill')
    expect(r.frameCount).toBe(2)
    expect(r.durationMs).toBe(1000)
    // 关键调用都已发生
    expect(mockVision.startRecording).toHaveBeenCalledWith(1)
    expect(mockVision.stopRecording).toHaveBeenCalled()
    expect(mockCreator.createSkill).toHaveBeenCalled()
    expect(mockCreator.saveDraftToDisk).toHaveBeenCalled()
    expect(mockSigner.sign).toHaveBeenCalled()
    expect(mockVersioning.record).toHaveBeenCalled()
    expect(mockHermes.importContext).toHaveBeenCalled()
    expect(mockRuntime.register).toHaveBeenCalled()
  })
})
