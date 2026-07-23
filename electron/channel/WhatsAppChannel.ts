/**
 * PiPiClaw - Channel / WhatsAppChannel (P1-02)
 *
 * WhatsApp 通道真实实现(基于 WhatsApp Business Cloud API):
 * 1. validateToken — 调 /{phone-id} 校验 access token
 * 2. send — POST /{phone-id}/messages
 * 3. markAsRead — POST /{phone-id}/messages 标记已读
 * 4. healthCheck — token 校验
 *
 * 限制:
 * - 需要 WhatsApp Business 账号 + phone number ID
 * - 文件上传需要 resumable upload 协议(Stage 2 走 FileTransferManager)
 * - 实时消息用 Webhook(需要公网回调,留给 release 后阶段)
 *
 * API 文档:https://developers.facebook.com/docs/whatsapp/cloud-api/reference
 */

import { LogManager } from '../core/LogManager'
import type {
  Channel,
  ChannelMessage,
  MessageHandler,
  Disposable,
  ChannelHealth,
} from '../contracts/types'

const WHATSAPP_API = 'https://graph.facebook.com/v20.0'

export interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  apiBaseUrl?: string
}

export interface WhatsAppMessage {
  messaging_product: 'whatsapp'
  to: string
  type: 'text'
  text: { body: string }
}

export interface WhatsAppResponse {
  messaging_product: 'whatsapp'
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

export class WhatsAppChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private handlers: MessageHandler[] = []
  private config: WhatsAppConfig | null = null

  constructor(id: string = 'whatsapp-main') {
    this.id = id
  }

  setConfig(config: WhatsAppConfig): void {
    this.config = config
  }

  /**
   * 校验 access token + phone number ID
   * 调 GET /{phone-id} 看是否 200
   */
  async validateToken(): Promise<{ phoneNumberId: string; verified: true }> {
    if (!this.config?.phoneNumberId || !this.config?.accessToken) {
      throw new Error('WhatsAppChannel: phoneNumberId / accessToken 未配置')
    }
    const apiBase = this.config.apiBaseUrl ?? WHATSAPP_API
    const res = await fetch(`${apiBase}/${this.config.phoneNumberId}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`WhatsApp token 校验失败: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    return { phoneNumberId: this.config.phoneNumberId, verified: true }
  }

  /**
   * 发送文本消息
   * msg.to 是用户手机号(国际格式,如 8613800000000)
   */
  async send(msg: ChannelMessage): Promise<{ messageId: string }> {
    if (!this.config?.phoneNumberId || !this.config?.accessToken) {
      throw new Error('WhatsAppChannel: phoneNumberId / accessToken 未配置')
    }
    const apiBase = this.config.apiBaseUrl ?? WHATSAPP_API
    if (!msg.to) {
      throw new Error('WhatsAppChannel: msg.to (phone number) 不能为空')
    }
    const body: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'text',
      text: { body: msg.text ?? '' },
    }
    const res = await fetch(`${apiBase}/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`WhatsApp send 失败: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    const data = (await res.json()) as WhatsAppResponse
    const messageId = data.messages[0]?.id
    if (!messageId) {
      throw new Error('WhatsApp send: 响应无 messageId')
    }
    this.log.info(`WhatsAppChannel: 已发消息 ${messageId} → ${msg.to}`)
    return { messageId }
  }

  /**
   * 标记消息已读
   * status: 'read' / 'delivered'
   */
  async markAsRead(messageId: string, status: 'read' | 'delivered' = 'read'): Promise<void> {
    if (!this.config?.phoneNumberId || !this.config?.accessToken) {
      throw new Error('WhatsAppChannel: 未配置')
    }
    const apiBase = this.config.apiBaseUrl ?? WHATSAPP_API
    const res = await fetch(`${apiBase}/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status,
        message_id: messageId,
      }),
    })
    if (!res.ok) {
      throw new Error(`WhatsApp markAsRead 失败: HTTP ${res.status}`)
    }
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

  /**
   * 内部 push(用于 Webhook 推送或测试桩)
   */
  __pushIncoming(msg: ChannelMessage): void {
    for (const h of this.handlers) {
      void h(msg)
    }
  }

  async healthCheck(): Promise<ChannelHealth> {
    if (!this.config?.phoneNumberId || !this.config?.accessToken) {
      return { healthy: false, error: 'no phoneNumberId / accessToken configured' }
    }
    try {
      await this.validateToken()
      return { healthy: true, latencyMs: 0, details: { phoneNumberId: this.config.phoneNumberId } }
    } catch (e) {
      return { healthy: false, error: String(e) }
    }
  }
}
