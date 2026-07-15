/**
 * PiPiClaw - Channel / IMSecurityManager (W7.1)
 *
 * 消息安全过滤(防 XSS / 命令注入 / 恶意 payload)。
 * W7 阶段:简单正则黑名单。W8+ 接专业清洗库(DOMPurify / sanitize-html)。
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ChannelMessage } from '../contracts/types'
import type { ProcessedMessage } from './ChannelTypes'
import { randomUUID } from 'node:crypto'

const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /data:text\/html/i,
  /\bexec\b.*\b(rm|rm -rf|del)\b/i,
]

/**
 * IMSecurityManager: 消息安全过滤(防 XSS / 命令注入 / 恶意 payload)
 * W7 阶段:简单正则黑名单
 * W8+ 接专业清洗库(DOMPurify / sanitize-html)
 */
export class IMSecurityManager {
  private static instance: IMSecurityManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()

  private constructor() {}

  public static getInstance(): IMSecurityManager {
    if (!IMSecurityManager.instance) IMSecurityManager.instance = new IMSecurityManager()
    return IMSecurityManager.instance
  }

  /**
   * 校验 + 清洗一条消息
   * 返回 ProcessedMessage:allowed + sanitized
   */
  process(message: ChannelMessage, channelId: string): ProcessedMessage {
    const text = message.text ?? ''
    const dangerous: string[] = []
    for (const p of DANGEROUS_PATTERNS) {
      if (p.test(text)) dangerous.push(p.source)
    }
    const sanitized = dangerous.length === 0
    const cleanContent = sanitized ? text : this.sanitize(text)
    return {
      id: randomUUID(),
      channelId,
      raw: message,
      allowed: true,
      sanitized,
      cleanContent,
      rejectReason: sanitized ? undefined : `检测到危险模式: ${dangerous.join(', ')}`,
      ts: Date.now(),
    }
  }

  private sanitize(text: string): string {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, '[script-removed]')
      .replace(/javascript:/gi, 'js-blocked:')
      .replace(/data:text\/html/gi, 'data-blocked:')
  }
}