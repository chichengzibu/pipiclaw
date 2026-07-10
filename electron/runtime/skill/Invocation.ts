import type { SkillContext } from './Context'
import { randomUUID } from 'node:crypto'
import type { Disposable } from '../../contracts/types'

export type InvocationState = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface SkillInput {
  [k: string]: unknown
}

export interface SkillOutput {
  ok: boolean
  data?: unknown
  error?: string
  durationMs: number
}

export type InvocationId = string

export interface InvocationOptions {
  timeoutMs?: number
  allowNested?: boolean
}

export class Invocation {
  public readonly id: InvocationId
  public readonly skillName: string
  public readonly context: SkillContext
  public readonly input: SkillInput
  public readonly options: InvocationOptions
  public state: InvocationState = 'pending'
  public result?: SkillOutput
  public startedAt?: number
  public completedAt?: number

  constructor(skillName: string, input: SkillInput, context: SkillContext, options: InvocationOptions = {}) {
    this.id = randomUUID()
    this.skillName = skillName
    this.input = input
    this.context = context
    this.options = options
  }

  markRunning(): void {
    this.state = 'running'
    this.startedAt = Date.now()
  }

  markSuccess(data: unknown): void {
    this.state = 'success'
    this.result = { ok: true, data, durationMs: (Date.now() - (this.startedAt ?? Date.now())) }
    this.completedAt = Date.now()
  }

  markFailed(error: string): void {
    this.state = 'failed'
    this.result = { ok: false, error, durationMs: (Date.now() - (this.startedAt ?? Date.now())) }
    this.completedAt = Date.now()
  }

  markCancelled(): void {
    this.state = 'cancelled'
    this.completedAt = Date.now()
  }
}

export function createInvocationSubscription(inv: Invocation, onChange: (state: InvocationState) => void): Disposable {
  const check = setInterval(() => onChange(inv.state), 50)
  return { dispose: () => clearInterval(check) }
}