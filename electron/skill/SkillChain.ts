import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { SkillRuntime } from '../runtime/skill/SkillRuntime'
import { randomUUID } from 'node:crypto'

export interface ChainStep {
  skillName: string
  inputFromOutput?: string
  outputTo?: string
  onError?: 'abort' | 'continue' | 'retry'
  retries?: number
}

export interface ChainSpec {
  name: string
  description: string
  steps: ChainStep[]
}

export interface ChainStepResult {
  stepIndex: number
  skillName: string
  ok: boolean
  result?: unknown
  error?: string
  durationMs: number
}

export interface ChainExecutionResult {
  chainName: string
  chainId: string
  ok: boolean
  steps: ChainStepResult[]
  outputs: Record<string, unknown>
  totalDurationMs: number
}

/**
 * SkillChain: 技能链组合(W6 阶段为 orchestration 注册基础)。
 * W7 阶段:支持并行分支 / 条件判断。
 */
export class SkillChain {
  private static instance: SkillChain
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private registry: Map<string, ChainSpec> = new Map()

  private constructor() {}

  public static getInstance(): SkillChain {
    if (!SkillChain.instance) SkillChain.instance = new SkillChain()
    return SkillChain.instance
  }

  register(spec: ChainSpec): void {
    if (this.registry.has(spec.name)) {
      this.log.warn(`SkillChain: ${spec.name} 重复注册,覆盖`)
    }
    this.registry.set(spec.name, spec)
    this.log.info(`SkillChain: 注册 ${spec.name} (${spec.steps.length} 步骤)`)
  }

  unregister(name: string): boolean {
    return this.registry.delete(name)
  }

  list(): ChainSpec[] {
    return [...this.registry.values()]
  }

  get(name: string): ChainSpec | undefined {
    return this.registry.get(name)
  }

  async run(name: string, initialInput: Record<string, unknown> = {}): Promise<ChainExecutionResult> {
    const spec = this.registry.get(name)
    if (!spec) throw new Error(`SkillChain: ${name} 未注册`)
    const chainId = randomUUID()
    const startMs = Date.now()
    const stepResults: ChainStepResult[] = []
    const outputs: Record<string, unknown> = {}
    let lastOutput: unknown = initialInput
    const runtime = SkillRuntime.getInstance()

    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i]
      let input: unknown
      if (i === 0) {
        input = initialInput
      } else if (step.inputFromOutput) {
        if (step.inputFromOutput === '$') {
          input = lastOutput
        } else {
          const parts = step.inputFromOutput.split('.')
          let cursor: any = outputs
          for (const p of parts) cursor = cursor?.[p]
          input = cursor
        }
      } else {
        input = lastOutput
      }

      const stepStartMs = Date.now()
      let result: { ok: boolean; data?: unknown; error?: string; durationMs: number }
      try {
        result = await runtime.invoke(step.skillName, input as Record<string, unknown>)
        const durationMs = Date.now() - stepStartMs
        if (result.ok) {
          stepResults.push({ stepIndex: i, skillName: step.skillName, ok: true, result: result.data, durationMs })
          if (step.outputTo) outputs[step.outputTo] = result.data
          lastOutput = result.data
        } else {
          stepResults.push({ stepIndex: i, skillName: step.skillName, ok: false, error: result.error, durationMs })
          if (step.onError === 'continue') {
            lastOutput = null
            continue
          } else if (step.onError === 'retry' && (step.retries ?? 0) > 0) {
            let lastRetryResult = result
            for (let r = 0; r < (step.retries ?? 0); r++) {
              lastRetryResult = await runtime.invoke(step.skillName, input as Record<string, unknown>)
              if (lastRetryResult.ok) break
            }
            if (!lastRetryResult.ok) {
              return { chainName: name, chainId, ok: false, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
            }
            continue
          }
          return { chainName: name, chainId, ok: false, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
        }
      } catch (e) {
        stepResults.push({ stepIndex: i, skillName: step.skillName, ok: false, error: String(e), durationMs: Date.now() - stepStartMs })
        return { chainName: name, chainId, ok: false, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
      }
    }

    const result: ChainExecutionResult = { chainName: name, chainId, ok: true, steps: stepResults, outputs, totalDurationMs: Date.now() - startMs }
    void this.bus.publish('chain:completed', { chainName: name, chainId, totalDurationMs: result.totalDurationMs })
    return result
  }
}