/**
 * PiPiClaw - WebContainerRunner (W11.1)
 *
 * 职责:
 * 1. 集成 @webcontainer/api(浏览器内零容器前端运行时)
 * 2. 暴露 boot / mount / spawn / onServerReady 接口,供上层(P7 WebContainer Mode)使用
 *
 * W11 阶段:stub 实现,所有方法 log.warn + 返回 stub 标记
 * 真实集成需要 BrowserWindow 加载 webcontainer api,W12+ 评估
 *
 * 引入 @webcontainer/api 只是为了让类型存在,代码能 import;
 * 主进程实际不直接运行 WebContainer(浏览器-only)。
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { Workspace, WorkspaceManager } from './workspace'
import { randomUUID } from 'node:crypto'

export interface WebContainerFile {
  path: string
  content: string
  /** 内部文件还是目录 */
  isDirectory?: boolean
}

export interface SpawnResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  /** W11 阶段均为 stub */
  stub: boolean
}

export interface ServerReadyEvent {
  /** 容器内端口 */
  port: number
  /** 公开 URL(W11 stub:返回 placeholder) */
  url: string
  ts: number
}

type ServerReadyHandler = (e: ServerReadyEvent) => void

export class WebContainerRunner {
  private static instance: WebContainerRunner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private workspaceManager = WorkspaceManager.getInstance()
  private booted = false
  private serverReadyHandlers: ServerReadyHandler[] = []
  private mountedWorkspaceId: string | null = null

  private constructor() {}

  public static getInstance(): WebContainerRunner {
    if (!WebContainerRunner.instance) WebContainerRunner.instance = new WebContainerRunner()
    return WebContainerRunner.instance
  }

  async boot(): Promise<{ ok: boolean; stub: boolean }> {
    if (this.booted) return { ok: true, stub: false }
    this.log.warn('WebContainerRunner.boot: W11 stub,真实 boot 需 BrowserWindow 加载 webcontainer api,W12+ 评估')
    this.booted = true
    void this.bus.publish('webcontainer:booted', { stub: true })
    return { ok: true, stub: true }
  }

  async mount(workspaceId: string): Promise<{ ok: boolean; fileCount: number; stub: boolean }> {
    const ws: Workspace | undefined = this.workspaceManager.getWorkspace(workspaceId)
    if (!ws) return { ok: false, fileCount: 0, stub: true }
    this.mountedWorkspaceId = workspaceId
    const fileCount = await this.countFiles(ws.hostPath)
    this.log.info(`WebContainerRunner.mount: ${workspaceId} (${fileCount} files, stub)`)
    void this.bus.publish('webcontainer:mounted', { workspaceId, fileCount })
    return { ok: true, fileCount, stub: true }
  }

  async spawn(cmd: string, args: string[] = []): Promise<SpawnResult> {
    if (!this.booted) {
      await this.boot()
    }
    this.log.warn(`WebContainerRunner.spawn: W11 stub (${cmd} ${args.join(' ')})`)
    void this.bus.publish('webcontainer:spawn', { cmd, args })
    return {
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: `W11 stub: ${cmd} ${args.join(' ')}`,
      durationMs: 0,
      stub: true,
    }
  }

  onServerReady(handler: ServerReadyHandler): { dispose: () => void } {
    this.serverReadyHandlers.push(handler)
    return {
      dispose: () => {
        const idx = this.serverReadyHandlers.indexOf(handler)
        if (idx >= 0) this.serverReadyHandlers.splice(idx, 1)
      },
    }
  }

  __emitServerReady(port: number): void {
    const event: ServerReadyEvent = { port, url: `http://localhost:${port}`, ts: Date.now() }
    for (const h of this.serverReadyHandlers) h(event)
    void this.bus.publish('webcontainer:server-ready', event)
  }

  isBooted(): boolean {
    return this.booted
  }

  getMountedWorkspaceId(): string | null {
    return this.mountedWorkspaceId
  }

  /** W11 helper:递归计数 workspace 文件 */
  private async countFiles(dir: string): Promise<number> {
    const fs = await import('node:fs/promises')
    let count = 0
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory()) {
          count += await this.countFiles(`${dir}/${e.name}`)
        } else {
          count += 1
        }
      }
    } catch {
      // ignore
    }
    return count
  }
}