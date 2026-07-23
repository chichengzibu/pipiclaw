/**
 * PiPiClaw - Channel / DiscordChannel (P1-01)
 *
 * Discord 通道真实实现(基于 REST API,无需 discord.js):
 * 1. validateToken — 调 /users/@me 验证 bot token
 * 2. send — POST /channels/{id}/messages
 * 3. listMessages — GET /channels/{id}/messages(轮询)
 * 4. healthCheck — token 校验
 *
 * 限制:
 * - 无 WebSocket gateway(实时消息推送),需轮询(30s 间隔,后续 P3 接 WebSocket)
 * - 文件上传需 multipart/form-data(Stage 2 通过 FileTransferManager.uploadToIM)
 *
 * API 文档:https://discord.com/developers/docs/reference
 */

import { LogManager } from '../core/LogManager'
import type {
  Channel,
  ChannelMessage,
  MessageHandler,
  Disposable,
  ChannelHealth,
} from '../contracts/types'

const DISCORD_API = 'https://discord.com/api/v10'

export interface DiscordConfig {
  botToken: string
  apiBaseUrl?: string
}

export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  bot: boolean
}

export interface DiscordMessage {
  id: string
  channel_id: string
  content: string
  author: { id: string; username: string; bot: boolean }
  timestamp: string
}

export class DiscordChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private handlers: MessageHandler[] = []
  private config: DiscordConfig | null = null
  private lastSeenMessageId: string | null = null

  constructor(id: string = 'discord-main') {
    this.id = id
  }

  /** 设置 bot token(从 IMConfigStore 注入) */
  setConfig(config: DiscordConfig): void {
    this.config = config
  }

  /**
   * 校验 bot token — 调 Discord /users/@me
   * 返回 user 对象(成功)或抛错(失败)
   */
  async validateToken(token: string): Promise<DiscordUser> {
    const apiBase = this.config?.apiBaseUrl ?? DISCORD_API
    const res = await fetch(`${apiBase}/users/@me`, {
      headers: { Authorization: `Bot ${token}` },
    })
    if (!res.ok) {
      throw new Error(`Discord token 校验失败: HTTP ${res.status}`)
    }
    return (await res.json()) as DiscordUser
  }

  /**
   * 发送消息到指定 channel
   */
  async send(msg: ChannelMessage): Promise<{ messageId: string }> {
    if (!this.config?.botToken) {
      throw new Error('DiscordChannel: bot token 未配置')
    }
    const apiBase = this.config.apiBaseUrl ?? DISCORD_API
    // msg.to 是 channelId(数字 snowflake)
    const channelId = msg.to
    if (!channelId) {
      throw new Error('DiscordChannel: msg.to (channelId) 不能为空')
    }
    const res = await fetch(`${apiBase}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${this.config.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: msg.text ?? '' }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Discord send 失败: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    const data = (await res.json()) as DiscordMessage
    this.log.info(`DiscordChannel: 已发消息 ${data.id} → channel ${channelId}`)
    return { messageId: data.id }
  }

  /**
   * 列出 channel 最近消息(轮询用)
   * limit 默认 50,max 100(Discord 限制)
   */
  async listMessages(channelId: string, limit: number = 50): Promise<DiscordMessage[]> {
    if (!this.config?.botToken) {
      throw new Error('DiscordChannel: bot token 未配置')
    }
    const apiBase = this.config.apiBaseUrl ?? DISCORD_API
    const safeLimit = Math.min(Math.max(1, limit), 100)
    const url = new URL(`${apiBase}/channels/${channelId}/messages`)
    url.searchParams.set('limit', String(safeLimit))
    if (this.lastSeenMessageId) {
      url.searchParams.set('after', this.lastSeenMessageId)
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bot ${this.config.botToken}` },
    })
    if (!res.ok) {
      throw new Error(`Discord list 失败: HTTP ${res.status}`)
    }
    const messages = (await res.json()) as DiscordMessage[]
    // 记录最新 messageId(用于下次轮询的 after)
    if (messages.length > 0) {
      this.lastSeenMessageId = messages[0].id
    }
    return messages
  }

  /**
   * 轮询 + 触发 onMessage 回调
   * 真实使用:用 setInterval(30000) 调 pollMessages(channelId)
   */
  async pollMessages(channelId: string): Promise<number> {
    const messages = await this.listMessages(channelId)
    let count = 0
    for (const m of messages) {
      if (m.author.bot) continue
      const channelMsg: ChannelMessage = {
        id: m.id,
        text: m.content,
        channel: 'discord',
        from: m.author.username,
        to: channelId,
        ts: new Date(m.timestamp).getTime(),
      }
      for (const h of this.handlers) void h(channelMsg)
      count += 1
    }
    return count
  }

  onMessage(handler: MessageHandler): Disposable {
    this.handlers.push(handler)
    return {
      dispose: () => {
        const idx = this.handlers.indexOf(handler)
        if (idx >= 0) this.handlers.splice(idx, 1)
      },
    }
  }

  __pushIncoming(msg: ChannelMessage): void {
    for (const h of this.handlers) {
      void h(msg)
    }
  }

  async healthCheck(): Promise<ChannelHealth> {
    if (!this.config?.botToken) {
      return { healthy: false, error: 'no bot token configured' }
    }
    try {
      const user = await this.validateToken(this.config.botToken)
      return { healthy: true, latencyMs: 0, details: { botId: user.id, username: user.username } }
    } catch (e) {
      return { healthy: false, error: String(e) }
    }
  }
}
