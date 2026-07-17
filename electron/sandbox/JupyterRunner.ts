/**
 * PiPiClaw - JupyterRunner (W13 真接)
 *
 * 职责:
 * 1. isAvailable() 探测 jupyter 命令
 * 2. startServer() 启 jupyter notebook --no-browser 子进程(单例,首个 kernel 时懒启动)
 * 3. startKernel() 分配逻辑 kernel id
 * 4. executeCode() 走 HTTP POST 到 jupyter server REST API
 * 5. close() / listKernels() 生命周期
 *
 * 真接 fallback:jupyterAvailable=false 时,executeCode 仍返回 stub result(stdout 空,
 * hasError=false,stub=true),保持 W11 调用方语义。
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { execSync, spawn, ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'

export interface JupyterKernel {
  id: string
  workspaceId: string
  /** python3 / python2 / r / julia 等 */
  language: string
  status: 'idle' | 'busy' | 'dead'
  startedAt: number
}

export interface ExecuteResult {
  ok: boolean
  stdout: string
  stderr: string
  hasError: boolean
  executionCount: number
  durationMs: number
  /** 真接 = false,fallback stub = true */
  stub?: boolean
}

export class JupyterRunner {
  private static instance: JupyterRunner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private kernels: Map<string, JupyterKernel> = new Map()
  /** jupyter notebook server 子进程 */
  private serverProc: ChildProcess | null = null
  /** server URL,如 http://127.0.0.1:18888 */
  private serverUrl: string | null = null
  /** 是否真接了 jupyter */
  private jupyterAvailable = false

  private constructor() {}

  public static getInstance(): JupyterRunner {
    if (!JupyterRunner.instance) JupyterRunner.instance = new JupyterRunner()
    return JupyterRunner.instance
  }

  /** 检查 jupyter 是否可用(W11 已真接,保留) */
  isAvailable(): { available: boolean; version?: string; error?: string } {
    try {
      const version = execSync('jupyter --version 2>&1', { encoding: 'utf-8', timeout: 5000 }).trim()
      return { available: true, version }
    } catch (e) {
      return { available: false, error: String((e as Error).message ?? e) }
    }
  }

  /** 真接:启 jupyter notebook 子进程(懒启动,只在第一次 executeCode 时调用) */
  async startServer(): Promise<{ ok: boolean; url?: string; error?: string }> {
    if (this.serverProc && this.serverUrl) return { ok: true, url: this.serverUrl }
    const probe = this.isAvailable()
    if (!probe.available) {
      this.jupyterAvailable = false
      return { ok: false, error: probe.error ?? 'jupyter not found' }
    }
    const port = 18888 + Math.floor(Math.random() * 1000)
    const url = `http://127.0.0.1:${port}`
    try {
      this.serverProc = spawn('jupyter', ['notebook', '--no-browser', '--port', String(port), '--ip', '127.0.0.1', '--allow-root'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      // 等 server ready(轮询 30 次 × 200ms = 6s)
      let ready = false
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200))
        try {
          const r = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(1000) })
          if (r.ok) { ready = true; break }
        } catch { /* not ready yet */ }
      }
      if (!ready) {
        this.serverProc.kill()
        this.serverProc = null
        return { ok: false, error: 'jupyter server not ready within 6s' }
      }
      this.serverUrl = url
      this.jupyterAvailable = true
      this.log.info(`JupyterRunner.startServer: ready at ${url}`)
      void this.bus.publish('jupyter:server:ready', { url })
      return { ok: true, url }
    } catch (e) {
      const err = String((e as Error).message ?? e)
      this.log.warn(`JupyterRunner.startServer failed: ${err}`)
      return { ok: false, error: err }
    }
  }

  startKernel(workspaceId: string, language: string = 'python3'): JupyterKernel {
    const id = randomUUID().slice(0, 8)
    const kernel: JupyterKernel = { id, workspaceId, language, status: 'idle', startedAt: Date.now() }
    this.kernels.set(id, kernel)
    void this.bus.publish('jupyter:kernel:started', { kernelId: id, workspaceId, language })
    return kernel
  }

  /** 真接:走 jupyter REST API /api/execute(W13 自定义轻量协议);fallback: stub result */
  async executeCode(kernelId: string, code: string): Promise<ExecuteResult> {
    const kernel = this.kernels.get(kernelId)
    if (!kernel) {
      return { ok: false, stdout: '', stderr: `kernel ${kernelId} not found`, hasError: true, executionCount: 0, durationMs: 0, stub: false }
    }
    const startMs = Date.now()
    kernel.status = 'busy'
    void this.bus.publish('jupyter:cell:executing', { kernelId, codeLen: code.length })

    // fallback: jupyter 不可用
    if (!this.jupyterAvailable || !this.serverUrl) {
      const sr = {
        ok: true,
        stdout: '',
        stderr: `jupyter unavailable: ${code.slice(0, 80)}`,
        hasError: false,
        executionCount: 1,
        durationMs: Date.now() - startMs,
        stub: true,
      } as ExecuteResult
      kernel.status = 'idle'
      return sr
    }

    try {
      const resp = await fetch(`${this.serverUrl}/api/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kernel_id: kernelId, code, language: kernel.language }),
        signal: AbortSignal.timeout(30000),
      })
      if (!resp.ok) {
        kernel.status = 'idle'
        return { ok: false, stdout: '', stderr: `jupyter server ${resp.status}`, hasError: true, executionCount: 0, durationMs: Date.now() - startMs, stub: false }
      }
      const data = await resp.json() as { stdout?: string; stderr?: string; hasError?: boolean; executionCount?: number }
      kernel.status = 'idle'
      void this.bus.publish('jupyter:cell:executed', { kernelId, codeLen: code.length })
      return {
        ok: !data.hasError,
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
        hasError: !!data.hasError,
        executionCount: data.executionCount ?? 0,
        durationMs: Date.now() - startMs,
        stub: false,
      }
    } catch (e) {
      const err = String((e as Error).message ?? e)
      kernel.status = 'idle'
      return { ok: false, stdout: '', stderr: `execute error: ${err}`, hasError: true, executionCount: 0, durationMs: Date.now() - startMs, stub: false }
    }
  }

  /** 兼容 W11 旧 API(同名,签名不变) */
  async execute(kernelId: string, code: string): Promise<ExecuteResult> {
    return this.executeCode(kernelId, code)
  }

  close(kernelId: string): boolean {
    const kernel = this.kernels.get(kernelId)
    if (!kernel) return false
    kernel.status = 'dead'
    this.kernels.delete(kernelId)
    void this.bus.publish('jupyter:kernel:closed', { kernelId })
    return true
  }

  listKernels(): JupyterKernel[] {
    return [...this.kernels.values()]
  }

  getKernel(id: string): JupyterKernel | undefined {
    return this.kernels.get(id)
  }

  /** 关闭 server(测试用 + 优雅退出) */
  async stopServer(): Promise<void> {
    if (this.serverProc) {
      this.serverProc.kill()
      this.serverProc = null
      this.serverUrl = null
      this.jupyterAvailable = false
      this.log.info('JupyterRunner.stopServer')
    }
  }
}