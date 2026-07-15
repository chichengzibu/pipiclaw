/**
 * PiPiClaw - Channel / IMPermissionManager (W7.1)
 *
 * 校验"谁可以对该通道说话 / 该通道可对谁说话"。W7 阶段:简单白名单。
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ChannelMessage } from '../contracts/types'
import type { ChannelKind } from './ChannelTypes'

/**
 * IMPermissionManager: 校验"谁可以对该通道说话/该通道可对谁说话"
 * W7 阶段:简单白名单(在内存 set 里)
 */
export class IMPermissionManager {
  private static instance: IMPermissionManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  /** channelKind → 允许的 userId/openId 列表 */
  private whitelist: Map<string, Set<string>> = new Map()

  private constructor() {}

  public static getInstance(): IMPermissionManager {
    if (!IMPermissionManager.instance) IMPermissionManager.instance = new IMPermissionManager()
    return IMPermissionManager.instance
  }

  grant(channelKind: ChannelKind, userId: string): void {
    const set = this.whitelist.get(channelKind) ?? new Set<string>()
    set.add(userId)
    this.whitelist.set(channelKind, set)
    this.log.info(`IMPermissionManager: ${channelKind} 授权 ${userId}`)
  }

  revoke(channelKind: ChannelKind, userId: string): boolean {
    const set = this.whitelist.get(channelKind)
    if (!set) return false
    return set.delete(userId)
  }

  check(channelKind: ChannelKind, userId: string): boolean {
    const set = this.whitelist.get(channelKind)
    if (!set || set.size === 0) return true // 空白名单 = 全允许
    return set.has(userId)
  }

  isAllowed(message: ChannelMessage, channelKind: ChannelKind): boolean {
    return this.check(channelKind, message.to)
  }

  listWhitelist(channelKind: ChannelKind): string[] {
    return [...(this.whitelist.get(channelKind) ?? new Set<string>())]
  }
}