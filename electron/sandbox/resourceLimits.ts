/**
 * PiPiClaw - Sandbox 资源限额(W10.2)
 *
 * 默认值:
 * - CPU:2 核
 * - 内存:4 GB(4096 MB)
 * - 磁盘:10 GB(10240 MB)
 * - 超时:30 分钟
 * - 最大并发:3 个 sandbox
 *
 * 持久化到 userData/resource-limits.json
 * 申请/释放通过 acquire(sandboxId) / release(sandboxId)
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface ResourceLimits {
  /** CPU 核数(0.5 / 1 / 2) */
  cpuCores: number
  /** 内存限制(MB) */
  memoryMb: number
  /** 磁盘限制(MB) */
  diskMb: number
  /** 超时(分钟) */
  timeoutMinutes: number
  /** 最大并发 sandbox 数 */
  maxConcurrent: number
}

const DEFAULT_LIMITS: ResourceLimits = {
  cpuCores: 2,
  memoryMb: 4096,
  diskMb: 10_240,
  timeoutMinutes: 30,
  maxConcurrent: 3,
}

export class ResourceLimitsManager {
  private static instance: ResourceLimitsManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storePath: string
  private limits: ResourceLimits
  private activeSandboxes: Set<string> = new Set()

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'resource-limits.json')
    this.limits = this.loadFromDisk()
  }

  public static getInstance(): ResourceLimitsManager {
    if (!ResourceLimitsManager.instance) ResourceLimitsManager.instance = new ResourceLimitsManager()
    return ResourceLimitsManager.instance
  }

  get(): ResourceLimits {
    return { ...this.limits }
  }

  set(patch: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...patch }
    this.persistToDisk()
    this.log.info('ResourceLimitsManager: updated')
  }

  reset(): void {
    this.limits = { ...DEFAULT_LIMITS }
    this.persistToDisk()
  }

  /** 申请资源(返回 ok / reason) */
  acquire(sandboxId: string): { ok: boolean; reason?: string } {
    if (this.activeSandboxes.size >= this.limits.maxConcurrent) {
      void this.bus.publish('resource:denied', { reason: 'max-concurrent', active: this.activeSandboxes.size })
      return { ok: false, reason: `max concurrent ${this.limits.maxConcurrent} reached` }
    }
    this.activeSandboxes.add(sandboxId)
    void this.bus.publish('resource:acquired', { sandboxId, active: this.activeSandboxes.size })
    return { ok: true }
  }

  /** 释放资源 */
  release(sandboxId: string): void {
    this.activeSandboxes.delete(sandboxId)
    void this.bus.publish('resource:released', { sandboxId, active: this.activeSandboxes.size })
  }

  /** 当前活动 sandbox 数 */
  activeCount(): number {
    return this.activeSandboxes.size
  }

  /** 别名:列出所有活动 sandbox ids */
  listActive(): string[] {
    return [...this.activeSandboxes]
  }

  /** 超时换算 */
  timeoutMs(): number {
    return this.limits.timeoutMinutes * 60 * 1000
  }

  private loadFromDisk(): ResourceLimits {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
      }
    } catch (e) {
      this.log.warn('ResourceLimitsManager: load failed', e)
    }
    return { ...DEFAULT_LIMITS }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.limits, null, 2))
    } catch (e) {
      this.log.warn('ResourceLimitsManager: persist failed', e)
    }
  }
}