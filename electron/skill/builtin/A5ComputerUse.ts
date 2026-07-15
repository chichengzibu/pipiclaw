/**
 * PiPiClaw - Skill / A5ComputerUse (W8.2)
 *
 * A5 Computer Use v1 minimal demo skill.
 * 流程:ComputerUseHandler.run() → 循环截屏+思考+执行
 * W8 stub:AgentBrain 决策固定返回 "screenshot" 之类的简单 action
 * W9+ 接真实 LLM
 */

import { LogManager } from '../../core/LogManager'
import { ComputerUseHandler, ComputerUseResult } from '../../computeruse/ComputerUseHandler'
import { EventBus } from '../../runtime/bridge/EventBus'
import { ActionExecutor } from '../../computeruse/ActionExecutor'
import { ScreenVision } from '../../computeruse/ScreenVision'

export const A5_SKILL_NAME = 'a5:computer-use-v1'

export interface A5Input {
  /** 用户自然语言描述(例如 "打开浏览器") */
  instruction: string
  /** 最大步数(默认 5) */
  maxSteps?: number
  /** 是否自动执行(默认 false,需用户在 UI 确认) */
  autoExecute?: boolean
}

/**
 * A5ComputerUse: A5 Computer Use v1 最小 demo
 */
export async function runA5(input: A5Input): Promise<{ ok: boolean; result?: ComputerUseResult; error?: string }> {
  const log = LogManager.getInstance()
  const handler = ComputerUseHandler.getInstance()
  const executor = ActionExecutor.getInstance()
  const vision = ScreenVision.getInstance()

  try {
    log.info(`A5ComputerUse: 启动 (${input.instruction.slice(0, 30)})`)
    if (input.autoExecute) {
      executor.setAutoExecute(true)
      log.warn('A5ComputerUse: autoExecute=true, 真实执行键盘鼠标')
    } else {
      log.info('A5ComputerUse: autoExecute=false,只记录(沙箱模式)')
    }
    const frame = await vision.captureFrame()
    if (!frame) {
      return { ok: false, error: 'A5: 截屏失败,无可用屏幕' }
    }
    void EventBus.getInstance().publish('a5:start', { instruction: input.instruction, frameWidth: frame.width, frameHeight: frame.height })

    const result = await handler.run({ id: `a5-${Date.now()}`, instruction: input.instruction, maxSteps: input.maxSteps ?? 5, autoExecute: input.autoExecute })
    void EventBus.getInstance().publish('a5:done', { taskId: result.taskId, stepCount: result.steps.length, hitMaxSteps: result.hitMaxSteps })
    return { ok: true, result }
  } catch (e) {
    log.error('A5ComputerUse: 失败', e)
    return { ok: false, error: String(e) }
  }
}

export const a5SkillHandler = {
  name: A5_SKILL_NAME,
  description: 'Computer Use v1 最小 demo(看屏幕+思考+执行)',
  requiresPermission: true,
  async execute(args: A5Input) {
    return runA5(args)
  },
}

/** W8.2 wire:由 main.ts 调用,把 A5 skill 注册到 SkillRuntime */
export function registerA5Skill(): void {
  const { SkillRuntime } = require('../../runtime/skill/SkillRuntime')
  SkillRuntime.getInstance().register({
    name: A5_SKILL_NAME,
    description: 'Computer Use v1 最小 demo',
    handler: async (args: any) => runA5(args as A5Input),
  })
}
