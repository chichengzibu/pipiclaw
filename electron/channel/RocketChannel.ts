/**
 * PiPiClaw - Channel / RocketChannel (W7.2)
 *
 * Rocket.Chat 通道(占位,W8+ 接 Rocket.Chat REST API)。
 */

import { LogManager } from '../core/LogManager'
import type {
  Channel,
  ChannelMessage,
  MessageHandler,
  Disposable,
  ChannelHealth,
} from '../contracts/types'

export class RocketChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private handlers: MessageHandler[] = []

  constructor(id: string = 'rocket-main') {
    this.id = id
  }

  async send(_msg: ChannelMessage): Promise<void> {
    this.log.warn('RocketChannel: 占位 stub,W8+ 接入 Rocket.Chat REST API')
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
    return { healthy: false, error: 'W7 stub: W8+ integrate Rocket.Chat REST API' }
  }
}