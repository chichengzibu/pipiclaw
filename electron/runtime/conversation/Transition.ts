import type { ConversationStateId } from './State'

/**
 * 状态转换规则(单向图,key → set of allowed next states)
 * 任何不在规则内的转换会被拒绝
 */
export const CONVERSATION_TRANSITIONS: Readonly<Record<ConversationStateId, ReadonlyArray<ConversationStateId>>> = {
  idle: ['thinking', 'done', 'error'],
  thinking: ['executing', 'done', 'waiting', 'error'],
  executing: ['thinking', 'waiting', 'done', 'error'],
  waiting: ['thinking', 'executing', 'done', 'error'],
  done: ['idle', 'thinking'],
  error: ['idle', 'done'],
}

export function canTransition(from: ConversationStateId, to: ConversationStateId): boolean {
  return CONVERSATION_TRANSITIONS[from].includes(to)
}