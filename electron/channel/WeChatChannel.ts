/**
 * PiPiClaw - Channel / WeChatChannel (W7.2)
 *
 * 微信公众号通道(占位,W8+ 接 SDK)。
 * W7 阶段:仅实现 Channel 接口,所有调用为 stub。
 * 真实 SDK: wechat / wechaty (W8+ 评估)
 */

import { LogManager } from '../core/LogManager'
import type {
  Channel,
  ChannelMessage,
  MessageHandler,
  Disposable,
  ChannelHealth,
} from '../contracts/types'

export class WeChatChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private handlers: MessageHandler[] = []

  constructor(id: string = 'wechat-mp') {
    this.id = id
  }

  async send(_msg: ChannelMessage): Promise<void> {
    this.log.warn('WeChatChannel: 占位 stub,W8+ 接入真实 SDK')
    return
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
    return { healthy: false, error: 'W7 stub: W8+ integrate wechaty SDK' }
  }
}