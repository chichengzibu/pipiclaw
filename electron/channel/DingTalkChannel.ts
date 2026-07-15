/**
 * PiPiClaw - Channel / DingTalkChannel (W7.2)
 *
 * 钉钉 IM 通道(真实 fetch 实现)。
 * API: https://oapi.dingtalk.com/gettoken (appKey + appSecret)
 * 发消息: https://oapi.dingtalk.com/robot/oos/send (或 topapi/message/corpconversation/asyncsend_v2)
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

export class DingTalkChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private configStore = IMConfigStore.getInstance()
  private bus = EventBus.getInstance()
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0
  private handlers: MessageHandler[] = []

  constructor(id: string = 'dingtalk-main') {
    this.id = id
  }

  async send(msg: ChannelMessage): Promise<void> {
    const config = this.configStore.get('im-dingtalk')
    if (!config?.enabled) {
      throw new Error('DingTalkChannel: 通道未启用或未配置')
    }
    const token = await this.getAccessToken()
    if (!token) {
      throw new Error('DingTalkChannel: accessToken 获取失败')
    }
    const body = {
      msg: {
        msgtype: 'text',
        text: { content: msg.text ?? '' },
      },
      userid_list: msg.to,
    }
    const res = await fetch(
      `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`DingTalkChannel: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    void this.bus.publish(
      'im:channel:send:ok',
      { channelId: this.id, msgTo: msg.to },
      'DingTalkChannel',
    )
    this.log.info(`DingTalkChannel: 消息已发送到 ${msg.to}`)
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
    const config = this.configStore.get('im-dingtalk')
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
    const config = this.configStore.get('im-dingtalk')
    if (!config?.appId || !config?.appSecret) return null
    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken
    }
    const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(config.appId)}&appsecret=${encodeURIComponent(config.appSecret)}`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return null
    const data = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number }
    if (data.errcode !== 0) {
      this.log.warn(`DingTalkChannel: auth fail ${data.errmsg}`)
      return null
    }
    this.accessToken = data.access_token ?? null
    this.accessTokenExpiresAt = Date.now() + ((data.expires_in ?? 7200) * 1000)
    return this.accessToken
  }
}