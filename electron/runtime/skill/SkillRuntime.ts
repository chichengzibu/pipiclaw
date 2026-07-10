import { LogManager } from '../../core/LogManager'
import { EventBus } from '../bridge/EventBus'
import { Scheduler, SchedulingStrategy } from '../scheduler/Scheduler'
import { SkillContext, SkillContextData } from './Context'
import { Invocation, SkillInput, SkillOutput, InvocationOptions } from './Invocation'

export type SkillHandler = (input: SkillInput, ctx: SkillContext) => Promise<unknown>

export interface SkillDefinition {
  name: string
  description: string
  handler: SkillHandler
  requiresPermission?: boolean
  defaultOptions?: InvocationOptions
}

export interface SkillRuntimeOptions {
  maxConcurrent?: number
  strategy?: SchedulingStrategy
  defaultTimeoutMs?: number
}

export class SkillRuntime {
  private static instance: SkillRuntime
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private skills: Map<string, SkillDefinition> = new Map()
  private invocations: Map<string, Invocation> = new Map()
  private scheduler: Scheduler
  private defaultTimeoutMs: number

  private constructor(opts: SkillRuntimeOptions = {}) {
    this.scheduler = new Scheduler({
      maxConcurrent: opts.maxConcurrent ?? 8,
      strategy: opts.strategy ?? 'priority',
    })
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 60_000
  }

  public static getInstance(): SkillRuntime {
    if (!SkillRuntime.instance) {
      SkillRuntime.instance = new SkillRuntime()
    }
    return SkillRuntime.instance
  }

  public static resetInstance(): void {
    if (SkillRuntime.instance) {
      SkillRuntime.instance.scheduler.stop()
    }
    SkillRuntime.instance = new SkillRuntime()
  }

  register(def: SkillDefinition): void {
    if (this.skills.has(def.name)) {
      this.log.warn(`SkillRuntime: skill ${def.name} 重复注册,覆盖`)
    }
    this.skills.set(def.name, def)
    this.log.info(`SkillRuntime: 注册 skill ${def.name}`)
  }

  unregister(name: string): void {
    this.skills.delete(name)
  }

  list(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  has(name: string): boolean {
    return this.skills.has(name)
  }

  async invoke(skillName: string, input: SkillInput, ctxData: Partial<SkillContextData> = {}, options: InvocationOptions = {}): Promise<SkillOutput> {
    const def = this.skills.get(skillName)
    if (!def) {
      return { ok: false, error: `Skill ${skillName} 未注册`, durationMs: 0 }
    }
    if (def.requiresPermission && !ctxData.permissionToken) {
      return { ok: false, error: `Skill ${skillName} 需要 permissionToken`, durationMs: 0 }
    }
    const ctx = new SkillContext(ctxData)
    const mergedOptions: InvocationOptions = { ...def.defaultOptions, ...options }
    const inv = new Invocation(skillName, input, ctx, mergedOptions)
    this.invocations.set(inv.id, inv)
    await this.bus.publish('skill:invocation:start', { id: inv.id, name: skillName }, 'SkillRuntime')
    inv.markRunning()
    try {
      const timeoutMs = mergedOptions.timeoutMs ?? this.defaultTimeoutMs
      const result = timeoutMs > 0
        ? await Promise.race([
            def.handler(input, ctx),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('skill timeout')), timeoutMs)),
          ])
        : await def.handler(input, ctx)
      inv.markSuccess(result)
      await this.bus.publish('skill:invocation:success', { id: inv.id, data: result }, 'SkillRuntime')
      return inv.result!
    } catch (e) {
      inv.markFailed(String(e))
      this.log.error(`SkillRuntime: skill ${skillName} 失败`, e)
      await this.bus.publish('skill:invocation:failed', { id: inv.id, error: inv.result?.error }, 'SkillRuntime')
      return inv.result!
    } finally {
      this.invocations.delete(inv.id)
    }
  }

  schedule(skillName: string, input: SkillInput, ctxData: Partial<SkillContextData> = {}, options: InvocationOptions & { priority?: number } = {}): Invocation {
    const def = this.skills.get(skillName)
    if (!def) {
      throw new Error(`Skill ${skillName} 未注册`)
    }
    const ctx = new SkillContext(ctxData)
    const mergedOptions: InvocationOptions = { ...def.defaultOptions, ...options }
    const inv = new Invocation(skillName, input, ctx, mergedOptions)
    this.invocations.set(inv.id, inv)
    this.scheduler.enqueue(async () => {
      inv.markRunning()
      try {
        const result = await def.handler(input, ctx)
        inv.markSuccess(result)
      } catch (e) {
        inv.markFailed(String(e))
      }
    }, { priority: options.priority })
    void this.scheduler.tick()
    return inv
  }

  getInvocation(id: string): Invocation | undefined {
    return this.invocations.get(id)
  }

  stats() {
    return {
      skills: this.skills.size,
      activeInvocations: this.invocations.size,
      scheduler: this.scheduler.stats(),
    }
  }

  stop(): void {
    this.scheduler.stop()
    for (const inv of Array.from(this.invocations.values())) {
      inv.markCancelled()
    }
    this.invocations.clear()
    this.skills.clear()
    this.log.info('SkillRuntime 已停止')
  }
}