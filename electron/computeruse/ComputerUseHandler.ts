import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { ScreenVision } from './ScreenVision'
import { ActionExecutor, ActionRequest, ActionResult } from './ActionExecutor'
import { AgentBrainImpl } from '../agent/AgentBrain'
import { LlmClient } from '../llm/LlmClient'
import { randomUUID } from 'node:crypto'

export interface ComputerUseTask {
  id: string
  /** 用户自然语言描述(例如 "打开浏览器") */
  instruction: string
  /** 最大步骤数(防无限循环) */
  maxSteps?: number
  /** 自动执行模式 */
  autoExecute?: boolean
}

export interface ComputerUseStep {
  stepIndex: number
  ts: number
  /** 屏幕理解结果 */
  understanding: string
  /** AgentBrain 决策 */
  decision: { action: string; payload: unknown }
  /** ActionExecutor 执行结果 */
  actionResult: ActionResult
  durationMs: number
}

export interface ComputerUseResult {
  ok: boolean
  taskId: string
  steps: ComputerUseStep[]
  finalOutput?: string
  totalDurationMs: number
  /** 是否达到 maxSteps 上限 */
  hitMaxSteps: boolean
  error?: string
}

/**
 * ComputerUseHandler: Computer Use 统一处理入口
 * 循环:截屏 → AgentBrain 思考 → ActionExecutor 执行 → 观察结果
 * W8 阶段:AgentBrain stub,W9+ 接真实 LLM
 */
export class ComputerUseHandler {
  private static instance: ComputerUseHandler
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private vision = ScreenVision.getInstance()
  private executor = ActionExecutor.getInstance()
  private brain = AgentBrainImpl.getInstance()

  private constructor() {}

  public static getInstance(): ComputerUseHandler {
    if (!ComputerUseHandler.instance) ComputerUseHandler.instance = new ComputerUseHandler()
    return ComputerUseHandler.instance
  }

  async run(task: ComputerUseTask): Promise<ComputerUseResult> {
    const taskId = task.id ?? randomUUID()
    const maxSteps = task.maxSteps ?? 5
    const startMs = Date.now()
    const steps: ComputerUseStep[] = []

    if (task.autoExecute) this.executor.setAutoExecute(true)

    this.log.info(`ComputerUseHandler: 启动 task ${taskId} (${task.instruction.slice(0, 40)})`)
    void this.bus.publish('computeruse:task:start', { taskId, instruction: task.instruction })

    for (let i = 0; i < maxSteps; i++) {
      const stepStartMs = Date.now()
      try {
        const analysis = await this.vision.captureAndAnalyze({ ocr: true, understand: true })
        const understanding = analysis.understanding?.description ?? '(no description)'

        const rawDecision = await this.brain.think({ conversationId: taskId, content: `[step ${i + 1}] ${task.instruction} | screen: ${understanding.slice(0, 100)}` } as any)
        const decision = await this.refineDecisionWithLlm(taskId, i + 1, task.instruction, understanding, rawDecision, this.log)

        const actionReq = this.decisionToAction(decision.action, decision.payload as any)
        let actionResult: ActionResult
        if (actionReq) {
          actionResult = await this.executor.execute(actionReq)
        } else {
          actionResult = { ok: true, actionId: 'noop-' + i, kind: 'screenshot' as any, durationMs: 0, executed: false, note: 'no action' }
        }

        const step: ComputerUseStep = {
          stepIndex: i,
          ts: Date.now(),
          understanding,
          decision: { action: decision.action, payload: decision.payload },
          actionResult,
          durationMs: Date.now() - stepStartMs,
        }
        steps.push(step)

        if (decision.action === 'reply' || decision.action === 'stop') {
          this.log.info(`ComputerUseHandler: 任务 ${taskId} 终止于 step ${i + 1} (action=${decision.action})`)
          break
        }
      } catch (e) {
        this.log.error(`ComputerUseHandler: step ${i + 1} 失败`, e)
        return {
          ok: false,
          taskId,
          steps,
          totalDurationMs: Date.now() - startMs,
          hitMaxSteps: i + 1 >= maxSteps,
          error: String(e),
        }
      }
    }

    void this.bus.publish('computeruse:task:end', { taskId, stepCount: steps.length, ok: true })
    return {
      ok: true,
      taskId,
      steps,
      finalOutput: steps[steps.length - 1]?.understanding,
      totalDurationMs: Date.now() - startMs,
      hitMaxSteps: steps.length >= maxSteps,
    }
  }

  /** 把 AgentBrain decision 翻译成 ActionRequest */
  private decisionToAction(action: string, payload: any): ActionRequest | null {
    if (!payload) return null
    if (action === 'click' || action === 'double-click' || action === 'type' || action === 'key-press' || action === 'scroll' || action === 'drag' || action === 'screenshot') {
      return { kind: action, ...(payload as any) } as ActionRequest
    }
    if (action === 'call') {
      const args = (payload as any).args ?? {}
      return { kind: args.kind ?? 'screenshot', ...args } as ActionRequest
    }
    return null
  }

  /**
   * W14:用 LLM 强化 AgentBrain 返回的 decision。
   * 若 LLM 可用且返回合法 JSON,则用 LLM 决策替换;否则 fallback 到 rawDecision。
   * 接受的动作:click / double-click / type / key-press / scroll / drag / screenshot / reply / stop
   */
  private async refineDecisionWithLlm(
    taskId: string,
    stepNum: number,
    instruction: string,
    understanding: string,
    rawDecision: { action: string; payload: unknown },
    log: LogManager,
  ): Promise<{ action: string; payload: unknown }> {
    const llm = LlmClient.getInstance()
    const systemPrompt = [
      '你是 Computer Use 任务规划助手,根据用户指令 + 当前屏幕理解,选择下一步动作。',
      '合法 action 值:click, double-click, type, key-press, scroll, drag, screenshot, reply, stop。',
      'payload 字段根据 action 调整:',
      '- click/double-click: {x, y, button?}',
      '- type: {text}',
      '- key-press: {key}',
      '- scroll: {dx, dy}',
      '- screenshot/reply/stop: {}',
      '只输出 JSON,不要 markdown 代码块,不要其他文字。',
    ].join('')
    const userPrompt = [
      `task_id=${taskId}, step=${stepNum}`,
      `instruction: ${instruction}`,
      `screen: ${understanding}`,
      `previous_decision: action=${rawDecision.action}, payload=${JSON.stringify(rawDecision.payload ?? {}).slice(0, 200)}`,
      '请给出下一步决策(action + payload)。',
    ].join('\n')

    try {
      const res = await llm.complete(userPrompt, { system: systemPrompt, maxTokens: 256, temperature: 0.3 })
      if (!res.ok || !res.content.trim()) {
        log.debug(`A5: LLM refine skipped (reason=${res.error ?? 'empty'}), use rawDecision`)
        return rawDecision
      }
      const parsed = this.parseLlmDecision(res.content)
      if (parsed) {
        log.info(`A5: LLM refined decision action=${parsed.action} (${res.model}, ${res.durationMs}ms)`)
        return parsed
      }
      log.debug(`A5: LLM output not parseable, fallback to raw`)
    } catch (e) {
      log.warn('A5: LLM refine failed', e)
    }
    return rawDecision
  }

  /** 解析 LLM 返回的 JSON 决策;若返回 markdown 代码块包裹,尝试 strip ``` ``` */
  private parseLlmDecision(raw: string): { action: string; payload: unknown } | null {
    let s = raw.trim()
    if (s.startsWith('```')) {
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    }
    const m = s.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      const obj = JSON.parse(m[0])
      if (!obj || typeof obj.action !== 'string') return null
      const validActions = ['click', 'double-click', 'type', 'key-press', 'scroll', 'drag', 'screenshot', 'reply', 'stop']
      if (!validActions.includes(obj.action)) return null
      return { action: obj.action, payload: obj.payload ?? {} }
    } catch {
      return null
    }
  }
}
