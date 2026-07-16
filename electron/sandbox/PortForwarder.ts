/**
 * PiPiClaw - PortForwarder (W11.2)
 *
 * 把容器内端口映射到 host 端口 + URL,
 * 供 renderer iframe 预览。
 *
 * W11 阶段:
 * - host 端口从 4000 开始递增分配
 * - 真转发逻辑 stub(由 SandboxProxy 兜底)
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { SandboxProxy } from './proxy'
import { randomUUID } from 'node:crypto'

export interface ForwardEntry {
  id: string
  /** 容器内端口 */
  containerPort: number
  /** host 上分配的端口 */
  hostPort: number
  /** 公开 URL(供 renderer iframe 用) */
  url: string
  /** workspace id(关联) */
  workspaceId?: string
  /** 创建时间 */
  createdAt: number
}

export interface ForwardResult {
  ok: boolean
  entry?: ForwardEntry
  error?: string
}

export class PortForwarder {
  private static instance: PortForwarder
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private proxy = SandboxProxy.getInstance()
  private entries: Map<string, ForwardEntry> = new Map()
  /** host 端口计数器 */
  private nextHostPort = 4000
  /** 已用 host 端口(避免重复) */
  private usedHostPorts: Set<number> = new Set()

  private constructor() {}

  public static getInstance(): PortForwarder {
    if (!PortForwarder.instance) PortForwarder.instance = new PortForwarder()
    return PortForwarder.instance
  }

  forwardPort(containerPort: number, workspaceId?: string): ForwardResult {
    const hostPort = this.allocateHostPort(containerPort)
    if (!hostPort) return { ok: false, error: `no free host port for container port ${containerPort}` }
    const id = randomUUID().slice(0, 8)
    const entry: ForwardEntry = {
      id,
      containerPort,
      hostPort,
      url: `http://localhost:${hostPort}`,
      workspaceId,
      createdAt: Date.now(),
    }
    this.entries.set(id, entry)
    this.usedHostPorts.add(hostPort)
    this.log.info(`PortForwarder.forwardPort: ${containerPort} → ${hostPort} (${entry.url})`)
    void this.bus.publish('port:forwarded', { id, containerPort, hostPort, url: entry.url })
    return { ok: true, entry }
  }

  listForwarded(): ForwardEntry[] {
    return [...this.entries.values()]
  }

  getForward(id: string): ForwardEntry | undefined {
    return this.entries.get(id)
  }

  closeForward(id: string): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    this.usedHostPorts.delete(e.hostPort)
    this.entries.delete(id)
    void this.bus.publish('port:closed', { id, hostPort: e.hostPort })
    return true
  }

  closeWorkspace(workspaceId: string): number {
    let count = 0
    for (const [id, e] of this.entries) {
      if (e.workspaceId === workspaceId) {
        this.closeForward(id)
        count += 1
      }
    }
    return count
  }

  async proxyRequest(id: string, req: { method: string; url: string; headers: Record<string, string>; body?: string }): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
    const e = this.entries.get(id)
    if (!e) return { statusCode: 404, body: 'forward not found', headers: {} }
    return this.proxy.forward(req, `http://localhost:${e.containerPort}`)
  }

  private allocateHostPort(containerPort: number): number | null {
    let attempt = this.nextHostPort
    for (let i = 0; i < 1000; i++) {
      if (!this.usedHostPorts.has(attempt)) {
        this.nextHostPort = attempt + 1
        return attempt
      }
      attempt += 1
    }
    return null
  }
}