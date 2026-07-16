/**
 * PiPiClaw - SandboxLifecycle (W11.4)
 *
 * 自动 stop idle / cleanup 老的 sandbox
 *
 * W11 阶段:
 * - 配置 + 调度器(每分钟检查一次)
 * - 不真停 sandbox(只 log.warn + 改 status + 释放资源)
 * - 真集成 W12+ 接 docker stop / WebContainer teardown
 *
 * 默认配置:
 * - idle 30 分钟自动 stop
 * - cleanup 24 小时后删除 workspace
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { WorkspaceManager } from './workspace'
import { ResourceLimitsManager } from './resourceLimits'
import { PortForwarder } from './PortForwarder'

export interface LifecycleConfig {
  /** sandbox 空闲多少分钟自动 stop(W11 默认 30) */
  idleStopMinutes: number
  /** sandbox 创建后多少小时清理(W11 默认 24) */
  cleanupHours: number
  /** 是否启用 idle stop */
  enableIdleStop: boolean
  /** 是否启用 cleanup */
  enableCleanup: boolean
}

const DEFAULT_CONFIG: LifecycleConfig = {
  idleStopMinutes: 30,
  cleanupHours: 24,
  enableIdleStop: true,
  enableCleanup: true,
}

interface SandboxState {
  workspaceId: string
  lastUsedAt: number
  createdAt: number
  status: 'running' | 'idle' | 'stopped'
}

export class SandboxLifecycle {
  private static instance: SandboxLifecycle
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private workspaceManager = WorkspaceManager.getInstance()
  private resourceLimits = ResourceLimitsManager.getInstance()
  private portForwarder = PortForwarder.getInstance()
  private config: LifecycleConfig = { ...DEFAULT_CONFIG }
  private states: Map<string, SandboxState> = new Map()
  private checkInterval: NodeJS.Timeout | null = null

  private constructor() {}

  public static getInstance(): SandboxLifecycle {
    if (!SandboxLifecycle.instance) SandboxLifecycle.instance = new SandboxLifecycle()
    return SandboxLifecycle.instance
  }

  /** 启动 lifecycle 调度器 */
  start(): void {
    if (this.checkInterval) return
    this.log.info('SandboxLifecycle: started')
    this.checkInterval = setInterval(() => this.check(), 60 * 1000)
  }

  /** 停止 lifecycle 调度器 */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      this.log.info('SandboxLifecycle: stopped')
    }
  }

  /** 标记 workspace 被使用(touch) */
  touch(workspaceId: string): void {
    const existing = this.states.get(workspaceId)
    if (existing) {
      existing.lastUsedAt = Date.now()
      existing.status = 'running'
    } else {
      this.states.set(workspaceId, {
        workspaceId,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        status: 'running',
      })
    }
  }

  /** 立即检查: idle stop + cleanup */
  check(): { idleStopped: number; cleaned: number } {
    const now = Date.now()
    const idleMs = this.config.idleStopMinutes * 60 * 1000
    const cleanupMs = this.config.cleanupHours * 60 * 60 * 1000
    let idleStopped = 0
    let cleaned = 0
    for (const [id, state] of this.states) {
      if (this.config.enableIdleStop && state.status !== 'idle' && state.status !== 'stopped' && now - state.lastUsedAt >= idleMs) {
        this.log.warn(`SandboxLifecycle: idle stop ${id}`)
        state.status = 'idle'
        this.portForwarder.closeWorkspace(id)
        this.resourceLimits.release(id)
        void this.bus.publish('sandbox:idle-stopped', { workspaceId: id })
        idleStopped += 1
      }
      if (this.config.enableCleanup && now - state.createdAt >= cleanupMs) {
        this.log.warn(`SandboxLifecycle: cleanup ${id}`)
        this.workspaceManager.deleteWorkspace(id)
        this.resourceLimits.release(id)
        this.states.delete(id)
        void this.bus.publish('sandbox:cleaned', { workspaceId: id })
        cleaned += 1
      }
    }
    return { idleStopped, cleaned }
  }

  getConfig(): LifecycleConfig {
    return { ...this.config }
  }

  setConfig(patch: Partial<LifecycleConfig>): void {
    this.config = { ...this.config, ...patch }
    this.log.info('SandboxLifecycle: config updated')
  }

  listStates(): SandboxState[] {
    return [...this.states.values()]
  }
}