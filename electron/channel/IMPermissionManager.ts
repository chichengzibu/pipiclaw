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

  /**
   * P2-04: 列出所有通道的授权(全量快照)
   */
  listAll(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [ch, set] of this.whitelist) {
      out[ch] = [...set]
    }
    return out
  }

  /**
   * P2-04: 导出为 JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.listAll(), null, 2)
  }

  /**
   * P2-04: 从 JSON 导入(覆盖式)
   * 格式:{ "im-feishu": ["user1", "user2"], ... }
   */
  importFromJson(json: string, mode: 'merge' | 'replace' = 'replace'): { imported: number; skipped: number } {
    let parsed: any
    try {
      parsed = JSON.parse(json)
    } catch (e) {
      throw new Error(`JSON 解析失败: ${(e as Error).message}`)
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('JSON 必须是 object')
    }
    let imported = 0
    let skipped = 0
    if (mode === 'replace') this.whitelist.clear()
    for (const [channel, users] of Object.entries(parsed)) {
      if (!Array.isArray(users)) {
        skipped += 1
        continue
      }
      const set = this.whitelist.get(channel) ?? new Set<string>()
      for (const u of users) {
        if (typeof u === 'string' && u.length > 0) {
          set.add(u)
          imported += 1
        }
      }
      this.whitelist.set(channel, set)
    }
    this.log.info(`IMPermissionManager: 导入 ${imported} entries, mode=${mode}`)
    return { imported, skipped }
  }

  /**
   * P2-04: 清空(慎用)
   */
  clearAll(): void {
    this.whitelist.clear()
  }
}