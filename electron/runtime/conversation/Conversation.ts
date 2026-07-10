import { LogManager } from '../../core/LogManager'
import type { ConversationStateId } from './State'
import { CONVERSATION_STATES } from './State'
import { canTransition } from './Transition'
import { EventBus } from '../bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type ConversationId = string

export interface ConversationContext {
  userId?: string
  conversationId: ConversationId
  currentMessageId?: string
  metadata?: Record<string, unknown>
}

export class Conversation {
  public readonly id: ConversationId
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private state: ConversationStateId = 'idle'
  private history: Array<{ from: ConversationStateId; to: ConversationStateId; ts: number; reason?: string }> = []

  constructor(id?: ConversationId) {
    this.id = id ?? randomUUID()
    this.log.debug(`Conversation ${this.id} 创建,初始状态 idle`)
  }

  getState(): ConversationStateId {
    return this.state
  }

  getStateInfo() {
    return CONVERSATION_STATES[this.state]
  }

  async transition(to: ConversationStateId, reason?: string): Promise<boolean> {
    if (this.state === to) return true
    if (!canTransition(this.state, to)) {
      this.log.warn(`Conversation ${this.id}: 非法转换 ${this.state} → ${to}`)
      return false
    }
    const from = this.state
    this.state = to
    this.history.push({ from, to, ts: Date.now(), reason })
    this.log.debug(`Conversation ${this.id}: ${from} → ${to}${reason ? ' (' + reason + ')' : ''}`)
    await this.bus.publish(`conversation:${this.id}:state`, { from, to, reason }, 'Conversation')
    return true
  }

  getHistory() {
    return [...this.history]
  }

  async reset(reason = 'manual reset'): Promise<void> {
    const from = this.state
    this.state = 'idle'
    this.history.push({ from, to: 'idle', ts: Date.now(), reason })
    this.log.warn(`Conversation ${this.id}: 强制重置到 idle (was ${from}, reason: ${reason})`)
  }
}