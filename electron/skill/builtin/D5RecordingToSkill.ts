import { ScreenVision } from '../../computeruse/ScreenVision'
import { AutoCreator } from '../AutoCreator'
import { SkillRuntime } from '../../runtime/skill/SkillRuntime'
import { SkillSigner } from '../SkillSigner'
import { SkillVersioning } from '../SkillVersioning'
import { HermesImporter } from '../HermesImporter'
import { LogManager } from '../../core/LogManager'
import { LlmClient } from '../../llm/LlmClient'

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

    const stepsText = await synthesizeStepsWithLlm(input, recording.frames.length, recording.durationMs, log)

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

/** W7.0.1:由 main.ts 调用,把 D5 skill 注册到 SkillRuntime */
export function registerD5RecordingToSkill(): void {
  const runtime = SkillRuntime.getInstance()
  runtime.register({
    name: D5_SKILL_NAME,
    description: '录屏 + 描述触发 → SKILL.md',
    handler: async (args: unknown) => runD5((args ?? {}) as { triggerPhrase: string; description?: string }),
  })
}

/**
 * W14:LLM synthesize detailed SKILL.md steps from triggerPhrase + user description + frame count.
 * 若 LLM 不可用(provider 未配置或请求失败),fallback 到基础步骤文案。
 */
async function synthesizeStepsWithLlm(
  input: D5Input,
  frameCount: number,
  durationMs: number,
  log: ReturnType<typeof LogManager.getInstance>,
): Promise<string> {
  const baseText = [
    '1. 用户打开屏幕录制(本 skill 自动触发)',
    `2. 录屏时长 ${durationMs}ms,捕获 ${frameCount} 帧`,
    `3. 用户填写的描述:${input.description ?? '(无)'}`,
    '4. (W7 接入)LLM 根据帧序列与 triggerPhrase 生成详细步骤',
  ].join('\n')

  const llm = LlmClient.getInstance()
  const systemPrompt = [
    '你是 PiPiClaw 的 SKILL.md 生成助手。',
    '根据用户提供的触发短语、描述、录屏帧数,产出 4-8 行可执行的步骤列表,',
    '每行以 "N. " 开头,使用简体中文,可包含鼠标动作 / 键盘动作 / 等待 / 截图 / 检查等动词。',
    '只输出步骤文本,不要输出任何额外的说明或前言。',
  ].join('')
  const userPrompt = [
    `触发短语:${input.triggerPhrase}`,
    `用户描述:${input.description ?? '(无)'}`,
    `录屏帧数:${frameCount} (总时长 ${durationMs}ms)`,
    '请基于以上信息生成 SKILL.md 的步骤段(steps 字段)。',
  ].join('\n')

  try {
    const res = await llm.complete(userPrompt, {
      system: systemPrompt,
      maxTokens: 512,
      temperature: 0.4,
    })
    if (res.ok && res.content.trim()) {
      log.info(`D5: LLM synthesize steps OK (${res.model}, ${res.durationMs}ms)`)
      return `1. 用户打开屏幕录制(本 skill 自动触发)\n2. 录屏时长 ${durationMs}ms,捕获 ${frameCount} 帧\n${res.content.trim()}`
    }
    log.warn(`D5: LLM unavailable, fallback to base text. reason=${res.error ?? 'empty'}`)
  } catch (e) {
    log.warn('D5: LLM call failed', e)
  }
  return baseText
}