/**
 * PiPiClaw - Channel / WechatWorkChannel (W7.2)
 *
 * 企业微信 IM 通道(真实 fetch 实现)。
 * API: https://qyapi.weixin.qq.com/cgi-bin/gettoken (corpid + corpsecret)
 * 发消息: https://qyapi.weixin.qq.com/cgi-bin/message/send (应用消息)
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

export class WechatWorkChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private configStore = IMConfigStore.getInstance()
  private bus = EventBus.getInstance()
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0
  private handlers: MessageHandler[] = []

  constructor(id: string = 'wechat-work-main') {
    this.id = id
  }

  async send(msg: ChannelMessage): Promise<void> {
    const config = this.configStore.get('im-wechat-work')
    if (!config?.enabled) {
      throw new Error('WechatWorkChannel: 通道未启用或未配置')
    }
    const token = await this.getAccessToken()
    if (!token) {
      throw new Error('WechatWorkChannel: accessToken 获取失败')
    }
    const body = {
      touser: msg.to,
      msgtype: 'text',
      agentid: config.appId,
      text: { content: msg.text ?? '' },
    }
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`WechatWorkChannel: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    void this.bus.publish(
      'im:channel:send:ok',
      { channelId: this.id, msgTo: msg.to },
      'WechatWorkChannel',
    )
    this.log.info(`WechatWorkChannel: 消息已发送到 ${msg.to}`)
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
    const config = this.configStore.get('im-wechat-work')
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
    const config = this.configStore.get('im-wechat-work')
    if (!config?.appId || !config?.appSecret) return null
    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken
    }
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(config.appId)}&corpsecret=${encodeURIComponent(config.appSecret)}`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return null
    const data = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number }
    if (data.errcode !== 0) {
      this.log.warn(`WechatWorkChannel: auth fail ${data.errmsg}`)
      return null
    }
    this.accessToken = data.access_token ?? null
    this.accessTokenExpiresAt = Date.now() + ((data.expires_in ?? 7200) * 1000)
    return this.accessToken
  }
}