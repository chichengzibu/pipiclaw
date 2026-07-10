export type ConversationStateId =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting'
  | 'done'
  | 'error'

export interface ConversationState {
  readonly id: ConversationStateId
  readonly displayName: string
  readonly description: string
}

export const CONVERSATION_STATES: Readonly<Record<ConversationStateId, ConversationState>> = {
  idle: { id: 'idle', displayName: '空闲', description: '等待用户输入' },
  thinking: { id: 'thinking', displayName: '思考中', description: '调用 LLM 推理' },
  executing: { id: 'executing', displayName: '执行中', description: '调用工具或子任务' },
  waiting: { id: 'waiting', displayName: '等待中', description: '等待用户确认或异步结果' },
  done: { id: 'done', displayName: '完成', description: '本回合结束,准备下一条' },
  error: { id: 'error', displayName: '错误', description: '出现错误,需要恢复或终止' },
}