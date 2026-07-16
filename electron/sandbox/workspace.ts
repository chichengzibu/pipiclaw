/**
 * PiPiClaw - Workspace 抽象(W9.3)
 *
 * host path = userData/sandboxes/{id}/mnt
 * container path = /mnt/data(固定,便于 docker -v 挂载)
 *
 * 职责:
 * 1. 创建 / 列出 / 查 / 删除 workspace
 * 2. host ↔ container 路径双向转换
 * 3. 持久化到 userData/sandboxes/index.json
 */

import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'

export interface Workspace {
  id: string
  /** host 上的物理路径(在 userData/sandboxes/{id}/mnt 下) */
  hostPath: string
  /** 容器内挂载路径(固定 /mnt/data) */
  containerPath: string
  /** 创建时间 */
  createdAt: number
  /** workspace 元信息(供 docker -v bind 用) */
  metadata: {
    /** 用户标记的 workspace 名称 */
    name?: string
    /** 工作区类型 */
    type?: 'project' | 'data' | 'cache'
  }
}

const WORKSPACE_BASE = path.join(app.getPath('userData'), 'sandboxes')

/**
 * WorkspaceManager:sandbox workspace 抽象
 * hostPath = userData/sandboxes/{id}/mnt
 * containerPath = /mnt/data(固定,便于 docker -v 挂载)
 */
export class WorkspaceManager {
  private static instance: WorkspaceManager
  private log = LogManager.getInstance()
  private workspaces: Map<string, Workspace> = new Map()
  private indexPath: string

  private constructor() {
    this.indexPath = path.join(WORKSPACE_BASE, 'index.json')
    if (!fs.existsSync(WORKSPACE_BASE)) fs.mkdirSync(WORKSPACE_BASE, { recursive: true })
    this.loadFromDisk()
  }

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) WorkspaceManager.instance = new WorkspaceManager()
    return WorkspaceManager.instance
  }

  /** 创建新 workspace(host 目录自动建) */
  createWorkspace(opts?: { name?: string; type?: 'project' | 'data' | 'cache' }): Workspace {
    const id = randomUUID().slice(0, 8)
    const hostPath = path.join(WORKSPACE_BASE, id, 'mnt')
    fs.mkdirSync(hostPath, { recursive: true })
    const workspace: Workspace = {
      id,
      hostPath,
      containerPath: '/mnt/data',
      createdAt: Date.now(),
      metadata: { name: opts?.name, type: opts?.type ?? 'project' },
    }
    this.workspaces.set(id, workspace)
    this.persistToDisk()
    this.log.info(`WorkspaceManager: created ${id} (${hostPath} → /mnt/data)`)
    return workspace
  }

  /** 列出所有 workspace(按 createdAt desc) */
  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  /** 查单个 */
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }

  /** 删除 workspace(host 目录也删) */
  deleteWorkspace(id: string): boolean {
    const w = this.workspaces.get(id)
    if (!w) return false
    try {
      const dir = path.dirname(w.hostPath)
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    } catch (e) {
      this.log.warn(`WorkspaceManager: delete ${id} fs fail`, String((e as Error).message ?? e))
    }
    this.workspaces.delete(id)
    this.persistToDisk()
    return true
  }

  /** host path → container path 转换 */
  toContainerPath(hostPath: string, workspaceId: string): string {
    const w = this.workspaces.get(workspaceId)
    if (!w) return hostPath
    const rel = path.relative(w.hostPath, hostPath)
    if (rel.startsWith('..')) return hostPath
    return path.posix.join(w.containerPath, rel.split(path.sep).join(path.posix.sep))
  }

  /** container path → host path 转换 */
  toHostPath(containerPath: string, workspaceId: string): string {
    const w = this.workspaces.get(workspaceId)
    if (!w) return containerPath
    if (!containerPath.startsWith(w.containerPath)) return containerPath
    const rel = containerPath.slice(w.containerPath.length).replace(/^\//, '')
    return path.join(w.hostPath, rel)
  }

  /** 别名:workspaceId 优先语义(供测试 + 未来 API) */
  hostToContainer(workspaceId: string, hostPath: string): string {
    // 1. 把 hostPath 当成"相对于 workspace 的路径"处理
    const w = this.workspaces.get(workspaceId)
    if (!w) return hostPath
    // 如果 hostPath 是 workspace hostPath 内的相对路径,直接 join
    const rel = hostPath.startsWith('/') ? hostPath.replace(/^\//, '') : hostPath
    return path.posix.join(w.containerPath, rel.split(path.sep).join(path.posix.sep))
  }

  /** 别名 */
  containerToHost(workspaceId: string, containerPath: string): string {
    return this.toHostPath(containerPath, workspaceId)
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        const arr = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as Workspace[]
        for (const w of arr) this.workspaces.set(w.id, w)
      }
    } catch (e) {
      this.log.warn('WorkspaceManager: load failed', String((e as Error).message ?? e))
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify([...this.workspaces.values()], null, 2))
    } catch (e) {
      this.log.warn('WorkspaceManager: persist failed', String((e as Error).message ?? e))
    }
  }
}