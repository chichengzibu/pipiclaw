/**
 * PiPiClaw - JupyterRunner (W11.3)
 *
 * 职责:
 * 1. isAvailable() 探测 jupyter 命令是否可用
 * 2. startKernel / execute / close kernel 生命周期
 * 3. 执行代码 cell,返回 ExecuteResult
 *
 * W11 阶段:
 * - startKernel / execute 都是 stub(只 log.warn,不真起 kernel)
 * - 真集成需要 python + jupyter + ipykernel,W12+ 评估
 * - W11 唯一允许的真操作是 isAvailable() 探测 jupyter --version
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

export interface JupyterKernel {
  id: string
  workspaceId: string
  /** ipykernel / python3 */
  language: string
  status: 'idle' | 'busy' | 'dead'
  startedAt: number
}

export interface ExecuteResult {
  ok: boolean
  /** stdout 输出 */
  stdout: string
  /** stderr 输出 */
  stderr: string
  /** 是否有错误 */
  hasError: boolean
  /** cell 计数 */
  executionCount: number
  durationMs: number
}

export class JupyterRunner {
  private static instance: JupyterRunner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private kernels: Map<string, JupyterKernel> = new Map()

  private constructor() {}

  public static getInstance(): JupyterRunner {
    if (!JupyterRunner.instance) JupyterRunner.instance = new JupyterRunner()
    return JupyterRunner.instance
  }

  /** 检查 jupyter 是否可用(W11 阶段只探测) */
  isAvailable(): { available: boolean; version?: string; error?: string } {
    try {
      const version = execSync('jupyter --version 2>&1', { encoding: 'utf-8', timeout: 5000 }).trim()
      return { available: true, version }
    } catch (e) {
      return { available: false, error: String((e as Error).message ?? e) }
    }
  }

  /** 启动 kernel(W11 stub) */
  startKernel(workspaceId: string, language: string = 'python3'): JupyterKernel {
    const id = randomUUID().slice(0, 8)
    const kernel: JupyterKernel = { id, workspaceId, language, status: 'idle', startedAt: Date.now() }
    this.kernels.set(id, kernel)
    this.log.warn(`JupyterRunner.startKernel: W11 stub (kernel ${id})`)
    void this.bus.publish('jupyter:kernel:started', { kernelId: id, workspaceId, language })
    return kernel
  }

  /** 执行代码(W11 stub,只记录到日志) */
  async execute(kernelId: string, code: string): Promise<ExecuteResult> {
    const kernel = this.kernels.get(kernelId)
    if (!kernel) return { ok: false, stdout: '', stderr: `kernel ${kernelId} not found`, hasError: true, executionCount: 0, durationMs: 0 }
    const startMs = Date.now()
    kernel.status = 'busy'
    this.log.warn(`JupyterRunner.execute: W11 stub (kernel ${kernelId})`)
    void this.bus.publish('jupyter:cell:executed', { kernelId, codeLen: code.length })
    kernel.status = 'idle'
    return {
      ok: true,
      stdout: '',
      stderr: `W11 stub: ${code.slice(0, 80)}`,
      hasError: false,
      executionCount: 1,
      durationMs: Date.now() - startMs,
    }
  }

  /** 关闭 kernel */
  close(kernelId: string): boolean {
    const kernel = this.kernels.get(kernelId)
    if (!kernel) return false
    kernel.status = 'dead'
    this.kernels.delete(kernelId)
    void this.bus.publish('jupyter:kernel:closed', { kernelId })
    return true
  }

  /** 列出所有 kernel */
  listKernels(): JupyterKernel[] {
    return [...this.kernels.values()]
  }

  getKernel(id: string): JupyterKernel | undefined {
    return this.kernels.get(id)
  }
}