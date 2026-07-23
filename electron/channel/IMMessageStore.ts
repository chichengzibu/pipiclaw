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

  /**
   * 统计各 channel 今日消息数(in + out)
   * 供 P0-02 状态仪表板用
   */
  getStats(opts: { sinceMs?: number } = {}): {
    total: number
    byChannel: Record<string, { in: number; out: number; total: number }>
    sinceMs: number
  } {
    const sinceMs = opts.sinceMs ?? this.startOfToday()
    const filtered = this.messages.filter((m) => m.ts >= sinceMs)
    const byChannel: Record<string, { in: number; out: number; total: number }> = {}
    for (const m of filtered) {
      if (!byChannel[m.channelId]) {
        byChannel[m.channelId] = { in: 0, out: 0, total: 0 }
      }
      byChannel[m.channelId][m.direction] += 1
      byChannel[m.channelId].total += 1
    }
    return { total: filtered.length, byChannel, sinceMs }
  }

  /**
   * 今日 0 点时间戳(本地时区)
   */
  private startOfToday(): number {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }

  clear(): void {
    this.messages = []
  }
}