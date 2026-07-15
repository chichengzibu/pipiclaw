/**
 * PiPiClaw - Channel / IMMessageStore (W7.1)
 *
 * 内存消息存储(FIFO 上限 1000)。W7 阶段:内存 Map,W8+ 接 SQLite。
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ChannelMessage } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export interface StoredMessage {
  id: string
  channelId: string
  direction: 'in' | 'out'
  message: ChannelMessage
  ts: number
  conversationId?: string
}

/**
 * IMMessageStore: 内存 + 持久化消息存储(FIFO 上限 1000)
 * W7 阶段:内存 Map,W8+ 接 SQLite
 */
export class IMMessageStore {
  private static instance: IMMessageStore
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private messages: StoredMessage[] = []
  private maxMessages = 1000

  private constructor() {}

  public static getInstance(): IMMessageStore {
    if (!IMMessageStore.instance) IMMessageStore.instance = new IMMessageStore()
    return IMMessageStore.instance
  }

  record(
    channelId: string,
    direction: 'in' | 'out',
    message: ChannelMessage,
    conversationId?: string,
  ): StoredMessage {
    const m: StoredMessage = {
      id: randomUUID(),
      channelId,
      direction,
      message,
      ts: Date.now(),
      conversationId,
    }
    this.messages.push(m)
    if (this.messages.length > this.maxMessages) this.messages.shift()
    void this.bus.publish(
      'im:message:recorded',
      { id: m.id, channelId, direction },
      'IMMessageStore',
    )
    return m
  }

  query(
    opts: { channelId?: string; direction?: 'in' | 'out'; sinceMs?: number; limit?: number } = {},
  ): StoredMessage[] {
    const sinceMs = opts.sinceMs
    let result = [...this.messages]
    if (opts.channelId) result = result.filter(m => m.channelId === opts.channelId)
    if (opts.direction) result = result.filter(m => m.direction === opts.direction)
    if (sinceMs !== undefined) result = result.filter(m => m.ts >= sinceMs)
    return result.slice(-(opts.limit ?? 50))
  }

  getById(id: string): StoredMessage | undefined {
    return this.messages.find(m => m.id === id)
  }

  clear(): void {
    this.messages = []
  }
}