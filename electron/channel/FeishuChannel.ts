/**
 * PiPiClaw - Channel / FeishuChannel (W7.2)
 *
 * 飞书 IM 通道(真实 fetch 实现)。
 * API: https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
 * 鉴权: appId + appSecret → tenant_access_token
 * 发消息: https://open.feishu.cn/open-apis/im/v1/messages
 */

import { LogManager } from '../core/LogManager'
import { IMConfigStore } from './IMConfigStore'
import { EventBus } from '../runtime/bridge/EventBus'
import type {
  Channel,
  ChannelMessage,
  MessageHandler,
  Disposable,
  ChannelHealth,
} from '../contracts/types'

export class FeishuChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private configStore = IMConfigStore.getInstance()
  private bus = EventBus.getInstance()
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0
  private handlers: MessageHandler[] = []

  constructor(id: string = 'feishu-main') {
    this.id = id
  }

  async send(msg: ChannelMessage): Promise<void> {
    const config = this.configStore.get('im-feishu')
    if (!config?.enabled) {
      throw new Error('FeishuChannel: 通道未启用或未配置')
    }
    const token = await this.getAccessToken()
    if (!token) {
      throw new Error('FeishuChannel: accessToken 获取失败')
    }
    const body = {
      receive_id: msg.to,
      msg_type: msg.text ? 'text' : 'post',
      content: JSON.stringify({ text: msg.text ?? '' }),
    }
    const res = await fetch(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`FeishuChannel: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    void this.bus.publish(
      'im:channel:send:ok',
      { channelId: this.id, msgTo: msg.to },
      'FeishuChannel',
    )
    this.log.info(`FeishuChannel: 消息已发送到 ${msg.to}`)
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

  /** W7 阶段没有真实 WebSocket 收消息;此方法只供测试时 push */
  __pushIncoming(msg: ChannelMessage): void {
    for (const h of this.handlers) {
      void h(msg)
    }
  }

  async healthCheck(): Promise<ChannelHealth> {
    const config = this.configStore.get('im-feishu')
    if (!config?.enabled) {
      return { healthy: false, error: 'not configured' }
    }
    const startMs = Date.now()
    try {
      const token = await this.getAccessToken()
      if (!token) return { healthy: false, error: 'auth fail' }
      return { healthy: true, latencyMs: Date.now() - startMs }
    } catch (e) {
      return { healthy: false, error: String(e) }
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const config = this.configStore.get('im-feishu')
    if (!config?.appId || !config?.appSecret) return null
    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken
    }
    const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { code?: number; msg?: string; tenant_access_token?: string; expire?: number }
    if (data.code !== 0) {
      this.log.warn(`FeishuChannel: auth fail ${data.msg}`)
      return null
    }
    this.accessToken = data.tenant_access_token ?? null
    this.accessTokenExpiresAt = Date.now() + ((data.expire ?? 7200) * 1000)
    return this.accessToken
  }
}