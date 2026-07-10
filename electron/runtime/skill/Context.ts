import type { ConversationId } from '../conversation/Conversation'
import { randomUUID } from 'node:crypto'

export type ContextId = string

export interface SkillContextData {
  userId?: string
  conversationId?: ConversationId
  permissionToken?: string
  env?: Record<string, string>
  cwd?: string
  state?: Record<string, unknown>
  trace: ContextId[]
}

export class SkillContext {
  public readonly id: ContextId
  public data: SkillContextData

  constructor(data: Partial<SkillContextData> = {}) {
    this.id = randomUUID()
    this.data = { ...data, trace: data.trace ?? [] }
  }

  fork(extra: Partial<SkillContextData> = {}): SkillContext {
    const child = new SkillContext({ ...this.data, ...extra, trace: [...this.data.trace, this.id] })
    return child
  }

  toJSON(): SkillContextData {
    return { ...this.data, trace: [...this.data.trace] }
  }
}