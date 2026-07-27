/**
 * PiPiClaw - Channel / ChannelRouter (W7.1)
 *
 * 管理所有 Channel 实例,提供统一入口。
 * - register / unregister channel
 * - send via channel id
 * - subscribe message via channel id
 * - list / get metadata
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { IMMessageRouter } from './IMMessageRouter'
import { RetryPolicy } from '../agent/RetryPolicy'
import type {
  Channel,
  ChannelMessage,
  ChannelHealth,
  MessageHandler,
} from '../contracts/types'
import type { ChannelMetadata, ChannelKind } from './ChannelTypes'

/**
 * ChannelRouter: 管理所有 Channel 实例,提供统一入口
 */
export class ChannelRouter {
  private static instance: ChannelRouter
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private messageRouter = IMMessageRouter.getInstance()
  private channels: Map<string, Channel> = new Map()
  private metadata: Map<string, ChannelMetadata> = new Map()
  private handlers: Map<string, MessageHandler> = new Map()

  private constructor() {}

  public static getInstance(): ChannelRouter {
    if (!ChannelRouter.instance) ChannelRouter.instance = new ChannelRouter()
    return ChannelRouter.instance
  }

  /** 注册一个 channel 实例 */
  register(channel: Channel, meta: Omit<ChannelMetadata, 'createdAt'>): void {
    if (this.channels.has(channel.id)) {
      this.log.warn(`ChannelRouter: ${channel.id} 重复注册,覆盖`)
    }
    this.channels.set(channel.id, channel)
    this.metadata.set(channel.id, { ...meta, createdAt: Date.now() })
    // 订阅 channel 收到的消息
    channel.onMessage(async msg => {
      const m = this.metadata.get(channel.id)
      if (!m) return
      const result = await this.messageRouter.handleIncoming(channel.id, m.kind, msg)
      void this.bus.publish('im:channel:incoming', { channelId: channel.id, ...result })
    })
    this.log.info(`ChannelRouter: 注册 ${channel.id} (${meta.kind})`)
  }

  unregister(channelId: string): boolean {
    const ok1 = this.channels.delete(channelId)
    const ok2 = this.metadata.delete(channelId)
    this.handlers.delete(channelId)
    return ok1 || ok2
  }

  get(channelId: string): Channel | undefined {
    return this.channels.get(channelId)
  }

  getMetadata(channelId: string): ChannelMetadata | undefined {
    return this.metadata.get(channelId)
  }

  listMetadata(): ChannelMetadata[] {
    return [...this.metadata.values()]
  }

  listByKind(kind: ChannelKind): ChannelMetadata[] {
    return [...this.metadata.values()].filter(m => m.kind === kind)
  }

  /** 通过 channelId 发送消息 */
  async send(channelId: string, message: ChannelMessage): Promise<{ ok: boolean; error?: string }> {
    const channel = this.channels.get(channelId)
    if (!channel) return { ok: false, error: `channel ${channelId} not found` }
    // P3-04: 失败重试 (exponential backoff via RetryPolicy)
    // maxAttempts=3, baseDelay=1s, backoff 2x: 1s → 2s → 4s
    // 不可重试错误 (4xx 等) 会立即抛出,不走 retry
    const retry = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000, backoffMultiplier: 2 })
    try {
      await retry.execute(() => channel.send(message), `channel-send:${channelId}`)
      void this.bus.publish('im:channel:send:ok', { channelId })
      return { ok: true }
    } catch (e) {
      void this.bus.publish('im:channel:send:fail', { channelId, error: String(e) })
      return { ok: false, error: String(e) }
    }
  }

  /** 订阅 channel 收到的事件(已通过 IMMessageRouter 处理) */
  subscribeChannel(channelId: string, handler: MessageHandler): void {
    this.handlers.set(channelId, handler)
  }

  /** 健康检查所有 channel */
  async healthCheckAll(): Promise<Record<string, ChannelHealth>> {
    const result: Record<string, ChannelHealth> = {}
    for (const [id, channel] of this.channels) {
      try {
        result[id] = await channel.healthCheck()
      } catch (e) {
        result[id] = { healthy: false, error: String(e) }
      }
    }
    return result
  }
}