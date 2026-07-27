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

/** P3-02 搜索命中 */
export interface SearchHit {
  message: StoredMessage
  /** 命中分数 (关键词命中数 + 标题加权) */
  score: number
  /** 命中了哪些关键词 */
  matchedTerms: string[]
  /** 含命中关键词的上下文片段 */
  snippet: string
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

  /**
   * P3-02: 全文搜索 (内存索引,等价 SQLite FTS5 API)
   * - 支持多关键词 (空格分隔)
   * - 按 channel / sender / 时间窗口过滤
   * - 评分: 命中关键词数 / 命中位置权重
   */
  search(opts: {
    query: string
    channelId?: string
    senderId?: string
    sinceMs?: number
    untilMs?: number
    limit?: number
  }): SearchHit[] {
    const terms = opts.query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 1)
    if (terms.length === 0) return []

    const candidates = this.messages.filter((m) => {
      if (opts.channelId && m.channelId !== opts.channelId) return false
      if (opts.senderId && m.message.from !== opts.senderId) return false
      if (opts.sinceMs !== undefined && m.ts < opts.sinceMs) return false
      if (opts.untilMs !== undefined && m.ts >= opts.untilMs) return false
      return true
    })

    const hits: SearchHit[] = []
    for (const m of candidates) {
      const text = `${m.message.text || ''} ${m.message.subject || ''}`.toLowerCase()
      const matchedTerms: string[] = []
      let score = 0
      for (const term of terms) {
        if (text.includes(term)) {
          matchedTerms.push(term)
          // 标题 (subject) 命中权重更高
          if ((m.message.subject || '').toLowerCase().includes(term)) score += 2
          else score += 1
        }
      }
      if (matchedTerms.length > 0) {
        hits.push({
          message: m,
          score,
          matchedTerms,
          snippet: this.makeSnippet(m.message.text || m.message.subject || '', terms),
        })
      }
    }
    hits.sort((a, b) => b.score - a.score || b.message.ts - a.message.ts)
    return hits.slice(0, opts.limit ?? 50)
  }

  /**
   * 提取含命中关键词的上下文片段 (前后各 30 字)
   */
  private makeSnippet(text: string, terms: string[]): string {
    const lower = text.toLowerCase()
    let firstHit = -1
    for (const term of terms) {
      const idx = lower.indexOf(term)
      if (idx !== -1 && (firstHit === -1 || idx < firstHit)) firstHit = idx
    }
    if (firstHit === -1) return text.slice(0, 60)
    const start = Math.max(0, firstHit - 30)
    const end = Math.min(text.length, firstHit + 60)
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
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