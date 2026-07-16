/**
 * PiPiClaw - Sandbox 网络白名单(W10.2)
 *
 * 职责:
 * 1. 默认白名单(9 个包管理镜像:npm / pypi / maven / go proxy 国内+官方)
 * 2. AI API 独立白名单(4 个:OpenAI / Anthropic / 智谱 / 阿里 DashScope)
 * 3. blockAll 总开关(紧急断网)
 * 4. 持久化到 userData/network-policy.json
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export type NetworkDomainCategory = 'package-manager' | 'ai-api' | 'web-content' | 'custom'

export interface NetworkWhitelistEntry {
  /** 域名(host 部分) */
  domain: string
  /** 分类 */
  category: NetworkDomainCategory
  /** 备注 */
  note?: string
  /** 是否启用 */
  enabled: boolean
}

export interface NetworkPolicyConfig {
  /** 默认白名单(包管理器国内镜像) */
  entries: NetworkWhitelistEntry[]
  /** 是否阻断所有外网(总开关) */
  blockAll: boolean
  /** AI API 通过 settings 配置(独立白名单) */
  aiApiDomains: string[]
}

const DEFAULT_CONFIG: NetworkPolicyConfig = {
  blockAll: false,
  aiApiDomains: ['api.openai.com', 'api.anthropic.com', 'open.bigmodel.cn', 'dashscope.aliyuncs.com'],
  entries: [
    { domain: 'registry.npmmirror.com', category: 'package-manager', note: 'npm cn mirror', enabled: true },
    { domain: 'registry.npmjs.org', category: 'package-manager', note: 'npm official', enabled: true },
    { domain: 'pypi.tuna.tsinghua.edu.cn', category: 'package-manager', note: 'pypi tuna mirror', enabled: true },
    { domain: 'pypi.org', category: 'package-manager', note: 'pypi official', enabled: true },
    { domain: 'maven.aliyun.com', category: 'package-manager', note: 'maven aliyun', enabled: true },
    { domain: 'repo.maven.apache.org', category: 'package-manager', note: 'maven official', enabled: true },
    { domain: 'goproxy.cn', category: 'package-manager', note: 'goproxy cn', enabled: true },
    { domain: 'goproxy.io', category: 'package-manager', note: 'goproxy io', enabled: true },
    { domain: 'proxy.golang.org', category: 'package-manager', note: 'go official', enabled: true },
  ],
}

export class NetworkPolicy {
  private static instance: NetworkPolicy
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storePath: string
  private config: NetworkPolicyConfig

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'network-policy.json')
    this.config = this.loadFromDisk()
  }

  public static getInstance(): NetworkPolicy {
    if (!NetworkPolicy.instance) NetworkPolicy.instance = new NetworkPolicy()
    return NetworkPolicy.instance
  }

  /** 判断某 host 是否被允许 */
  isAllowed(host: string): boolean {
    // AI API 永远允许(即使 blockAll)
    if (this.config.aiApiDomains.includes(host)) return true
    if (this.config.blockAll) return false
    // 白名单
    return this.config.entries.some(e => e.enabled && e.domain === host)
  }

  /** 添加白名单 */
  addEntry(entry: NetworkWhitelistEntry): boolean {
    const idx = this.config.entries.findIndex(e => e.domain === entry.domain)
    if (idx >= 0) {
      this.config.entries[idx] = entry
    } else {
      this.config.entries.push(entry)
    }
    this.persistToDisk()
    this.log.info(`NetworkPolicy: add ${entry.domain}`)
    return true
  }

  /** 移除白名单 */
  removeEntry(domain: string): boolean {
    const idx = this.config.entries.findIndex(e => e.domain === domain)
    if (idx < 0) return false
    this.config.entries.splice(idx, 1)
    this.persistToDisk()
    return true
  }

  /** 切换启用状态 */
  toggleEntry(domain: string, enabled?: boolean): boolean {
    const entry = this.config.entries.find(e => e.domain === domain)
    if (!entry) return false
    entry.enabled = enabled ?? !entry.enabled
    this.persistToDisk()
    return true
  }

  /** 列出所有 */
  list(): NetworkWhitelistEntry[] {
    return [...this.config.entries]
  }

  /** 阻断开关 */
  setBlockAll(blockAll: boolean): void {
    this.config.blockAll = blockAll
    this.persistToDisk()
    this.log.warn(`NetworkPolicy: blockAll = ${blockAll}`)
  }

  isBlockAll(): boolean {
    return this.config.blockAll
  }

  private loadFromDisk(): NetworkPolicyConfig {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
    } catch (e) {
      this.log.warn('NetworkPolicy: load failed', e)
    }
    return { ...DEFAULT_CONFIG }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.config, null, 2))
    } catch (e) {
      this.log.warn('NetworkPolicy: persist failed', e)
    }
  }
}