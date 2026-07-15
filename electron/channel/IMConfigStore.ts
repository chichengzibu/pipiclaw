/**
 * PiPiClaw - Channel / IMConfigStore (W7.1)
 *
 * 各 IM 通道鉴权信息存储:持久化到 userData/im-config.json。
 */

import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { ChannelKind } from './ChannelTypes'

export interface IMConfig {
  channelKind: ChannelKind
  /** 各平台不同字段 */
  appId?: string
  appSecret?: string
  botToken?: string
  webhookUrl?: string
  /** 通用字段 */
  apiBaseUrl?: string
  accessToken?: string
  accessTokenExpiresAt?: number
  /** 元信息 */
  enabled: boolean
  updatedAt: number
}

/**
 * IMConfigStore: 各 IM 通道鉴权信息存储
 * 持久化到 userData/im-config.json
 * 提供 get(key) / set(key, config) / list() / remove(key)
 */
export class IMConfigStore {
  private static instance: IMConfigStore
  private log = LogManager.getInstance()
  private storePath: string
  private configs: Map<string, IMConfig> = new Map()

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'im-config.json')
    this.loadFromDisk()
  }

  public static getInstance(): IMConfigStore {
    if (!IMConfigStore.instance) IMConfigStore.instance = new IMConfigStore()
    return IMConfigStore.instance
  }

  get(channelKind: ChannelKind): IMConfig | undefined {
    return this.configs.get(channelKind)
  }

  set(channelKind: ChannelKind, patch: Partial<IMConfig>): void {
    const existing = this.configs.get(channelKind) ?? {
      channelKind,
      enabled: false,
      updatedAt: Date.now(),
    }
    const next: IMConfig = { ...existing, ...patch, channelKind, updatedAt: Date.now() }
    this.configs.set(channelKind, next)
    this.persistToDisk()
    this.log.info(`IMConfigStore: ${channelKind} config updated`)
  }

  list(): IMConfig[] {
    return [...this.configs.values()]
  }

  remove(channelKind: ChannelKind): boolean {
    const ok = this.configs.delete(channelKind)
    if (ok) this.persistToDisk()
    return ok
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        const arr = JSON.parse(data) as IMConfig[]
        for (const c of arr) this.configs.set(c.channelKind, c)
      }
    } catch (e) {
      this.log.warn('IMConfigStore: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      const arr = [...this.configs.values()]
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true })
      fs.writeFileSync(this.storePath, JSON.stringify(arr, null, 2))
    } catch (e) {
      this.log.warn('IMConfigStore: persist failed', e)
    }
  }
}