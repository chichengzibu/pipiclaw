import { ScreenVision } from '../../computeruse/ScreenVision'
import { AutoCreator } from '../AutoCreator'
import { SkillRuntime } from '../../runtime/skill/SkillRuntime'
import { SkillSigner } from '../SkillSigner'
import { SkillVersioning } from '../SkillVersioning'
import { HermesImporter } from '../HermesImporter'
import { LogManager } from '../../core/LogManager'

export const D5_SKILL_NAME = 'd5:recording-to-skill'

export interface D5Input {
  triggerPhrase: string
  description?: string
}

export interface D5Result {
  ok: boolean
  skillName?: string
  frameCount?: number
  durationMs?: number
  error?: string
}

/**
 * D5RecordingToSkill: 录屏 → 帧序列 → AutoCreator → SKILL.md → 签名 → 版本。
 */
export async function runD5(input: D5Input): Promise<D5Result> {
  const log = LogManager.getInstance()
  const vision = ScreenVision.getInstance()
  const creator = AutoCreator.getInstance()
  const signer = SkillSigner.getInstance()
  const versioning = SkillVersioning.getInstance()
  const hermes = HermesImporter.getInstance()
  const runtime = SkillRuntime.getInstance()

  try {
    if (vision.isRecording()) {
      return { ok: false, error: 'D5: 请先停止当前录制再生成 skill' }
    }
    await vision.startRecording(1)
    await new Promise(r => setTimeout(r, 1500))
    const recording = await vision.stopRecording()
    if (!recording) return { ok: false, error: 'D5: 录屏失败(无可用帧)' }
    if (recording.frames.length === 0) return { ok: false, error: 'D5: 录屏获得 0 帧' }

    const stepsText = [
      '1. 用户打开屏幕录制(本 skill 自动触发)',
      `2. 录屏时长 ${recording.durationMs}ms,捕获 ${recording.frames.length} 帧`,
      `3. 用户填写的描述:${input.description ?? '(无)'}`,
      '4. (W7 接入)LLM 根据帧序列与 triggerPhrase 生成详细步骤',
    ].join('\n')

    const draft = await creator.createSkill({
      triggerPhrase: input.triggerPhrase,
      steps: stepsText,
    })

    draft.content += hermes.importContext(input.triggerPhrase)

    const filePath = await creator.saveDraftToDisk(draft)
    signer.sign(draft.name, draft.content)
    const versionMatch = draft.content.match(/version:\s*(\S+)/)
    const version = versionMatch?.[1] ?? '1.0.0'
    versioning.record(draft.name, draft.content, version, 'D5 recording')

    runtime.register({
      name: draft.name,
      description: draft.description,
      handler: async (args) => ({
        ok: true,
        stub: true,
        note: `[D5 stub] skill ${draft.name} executed with ${JSON.stringify(args)}`,
      }),
    })

    log.info(`D5: skill ${draft.name} 已生成,${recording.frames.length} 帧,落盘 ${filePath}`)
    return { ok: true, skillName: draft.name, frameCount: recording.frames.length, durationMs: recording.durationMs }
  } catch (e) {
    log.error('D5: 失败', e)
    return { ok: false, error: String(e) }
  }
}

export const d5SkillHandler = {
  name: D5_SKILL_NAME,
  description: '录屏 + 描述触发 → SKILL.md',
  requiresPermission: false,
  async execute(args: { triggerPhrase: string; description?: string }) {
    return runD5(args)
  },
}