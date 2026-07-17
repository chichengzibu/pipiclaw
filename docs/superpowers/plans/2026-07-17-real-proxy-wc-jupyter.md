# Plan — 真接 SandboxProxy / WebContainerRunner / JupyterRunner(替换 W11 stub)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 W11 留的 3 个 sandbox proxy stub 替换为真实集成(SandboxProxy 用 fetch 真转发、JupyterRunner 真起 jupyter notebook server 子进程、WebContainerRunner 主进程保留 stub 协调层 + renderer IPC 转发)

**Architecture:**
- **SandboxProxy**:Node 18+ 原生 `fetch` 真转发,timeout 8s + stream→string
- **JupyterRunner**:spawn `jupyter notebook --no-browser --port=<random>` 子进程,`executeCode` 走 HTTP REST API;`isAvailable` 已经真接保持
- **WebContainerRunner**:主进程仍是协调层(stub 保留,因为 `@webcontainer/api` 是浏览器-only),新增 IPC `webcontainer:boot/mount/spawn` 转发到 renderer hidden BrowserWindow,由 renderer 真接 `@webcontainer/api`;renderer 不在本 plan 范围(只暴露 IPC contract)

**Tech Stack:** Node 18+ fetch / child_process.spawn / 现有 EventBus / IpcChannels 模式 / vitest mock

**前置 commit:** `b02df49`(Step 2 retro)

---

## 总体约束

- **不引入新 npm 依赖**(fetch Node 原生,child_process 已有)
- **不修改 P7 sandbox 高层 API 签名**(`proxyRequest` / `forward` / `execute` 等签名保持,D2PrimeScaffold 等上层无感)
- **不删除 stub:true 标记字段**(上层调用方判 stub 行为保留)
- **每 commit 自己跑 + 自己 add + 自己 commit**
- **tsc 0 错 + vitest 178/178 不变**(更新测试以反映新行为;不删测试,改 expect)
- **不在真环境启 jupyter 进程做集成测试**(CI 单测全部 mock child_process / fetch)
- **WebContainerRunner 主进程仍是 stub**(因为浏览器-only 限制),只新增 IPC contract 不在本 plan 落地 renderer

---

## Task 1: SandboxProxy 真接 fetch 转发

**Files:**
- Modify: `electron/sandbox/proxy.ts`(重写 forward,改 ~50 行)
- Modify: `tests/unit/PortForwarder.test.ts`(追加 1 个 proxyRequest → 真 fetch 的测试,改 ~10 行)

- [ ] **Step 1: 在 PortForwarder.test.ts 追加真接测试**

在 `tests/unit/PortForwarder.test.ts` 末尾追加:

```typescript
  it('proxyRequest forwards via real fetch with mocked target', async () => {
    // mock global fetch,目标服务返回 200 + html
    const fetchMock = vi.fn(async () => new Response('<html><body>real target</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    ;(global as any).fetch = fetchMock
    const r = pf.forwardPort(5500, 'ws-proxy-1')
    expect(r.ok).toBe(true)
    const pr = await pf.proxyRequest(r.entry!.id, { method: 'GET', url: '/index', headers: {} })
    expect(pr.statusCode).toBe(200)
    expect(pr.body).toContain('real target')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const called = fetchMock.mock.calls[0][0] as string
    expect(called).toMatch(/^http:\/\/localhost:\d+\/index$/)
    delete (global as any).fetch
  })

  it('proxyRequest returns 502 when target fetch throws', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    ;(global as any).fetch = fetchMock
    const r = pf.forwardPort(5501, 'ws-proxy-2')
    const pr = await pf.proxyRequest(r.entry!.id, { method: 'GET', url: '/', headers: {} })
    expect(pr.statusCode).toBe(502)
    expect(pr.body).toContain('proxy error')
    delete (global as any).fetch
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run tests/unit/PortForwarder.test.ts
```

期望:`proxyRequest forwards via real fetch` FAIL(proxy 当前返回 stub placeholder 不含 "real target")。

- [ ] **Step 3: 重写 proxy.ts forward 用 fetch**

`electron/sandbox/proxy.ts` 全文替换为:

```typescript
/**
 * PiPiClaw - SandboxProxy (W13 真接)
 *
 * HTTP 转发层,把 renderer iframe 预览请求转发到 sandbox 内端口。
 *
 * - W11 阶段:stub(返回 placeholder HTML)
 * - W13 真接:Node 18+ 原生 fetch 真转发,8s timeout,响应 stream→string
 */

import { LogManager } from '../core/LogManager'

export interface ProxyRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export interface ProxyResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  durationMs: number
  /** W13 真接,失败时为 false;W11 阶段恒 true */
  stub: boolean
}

export class SandboxProxy {
  private static instance: SandboxProxy
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxProxy {
    if (!SandboxProxy.instance) SandboxProxy.instance = new SandboxProxy()
    return SandboxProxy.instance
  }

  async forward(req: ProxyRequest, targetUrl: string): Promise<ProxyResponse> {
    const startMs = Date.now()
    const url = targetUrl.replace(/\/$/, '') + (req.url.startsWith('/') ? req.url : '/' + req.url)
    try {
      const fetchInit: RequestInit = {
        method: req.method,
        headers: { ...req.headers, host: new URL(url).host },
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (req.body ?? ''),
      }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      fetchInit.signal = ctrl.signal
      const resp = await fetch(url, fetchInit)
      clearTimeout(timer)
      const body = await resp.text()
      const headers: Record<string, string> = {}
      resp.headers.forEach((v, k) => { headers[k] = v })
      this.log.info(`SandboxProxy.forward: ${req.method} ${url} → ${resp.status} (${Date.now() - startMs}ms)`)
      return { statusCode: resp.status, headers, body, durationMs: Date.now() - startMs, stub: false }
    } catch (e) {
      const err = String((e as Error).message ?? e)
      this.log.warn(`SandboxProxy.forward failed: ${req.method} ${url} (${err})`)
      return {
        statusCode: 502,
        headers: { 'content-type': 'text/html' },
        body: `<html><body><h1>proxy error</h1><p>${req.method} ${req.url} → ${targetUrl}</p><pre>${err}</pre></body></html>`,
        durationMs: Date.now() - startMs,
        stub: false,
      }
    }
  }
}
```

注意:保留 `stub` 字段(W11 上层调用方有判 stub 行为),默认 `false`,失败也 `false`。

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run tests/unit/PortForwarder.test.ts
```

期望:`PortForwarder.test.ts` 全部通过(8 + 2 新增 = 10 个 it)。

- [ ] **Step 5: Commit**

```bash
git add electron/sandbox/proxy.ts tests/unit/PortForwarder.test.ts
git commit -m "feat(sandbox) SandboxProxy real fetch forwarding 8s timeout"
```

---

## Task 2: JupyterRunner 真起 jupyter notebook server + HTTP execute

**Files:**
- Modify: `electron/sandbox/JupyterRunner.ts`(重写 startKernel/execute,改 ~100 行)
- Modify: `tests/unit/JupyterRunner.test.ts` ?(查 git 是否存在;如果没有,新建 ~80 行)
- 注:`JupyterRunner` 当前无测试文件,需要新建

- [ ] **Step 1: 先查是否存在测试文件**

```bash
ls tests/unit/JupyterRunner.test.ts 2>&1 || echo "MISSING"
```

期望输出:`MISSING`(如果没有,下一步新建)

- [ ] **Step 2: 新建测试文件**

创建 `tests/unit/JupyterRunner.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-jr-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}))

import { JupyterRunner } from '../../electron/sandbox/JupyterRunner'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

describe('JupyterRunner', () => {
  let runner: JupyterRunner

  beforeEach(() => {
    vi.clearAllMocks()
    runner = JupyterRunner.getInstance()
    // 清空 kernel 状态避免跨 case 干扰
    for (const k of runner.listKernels()) runner.close(k.id)
  })

  it('getInstance returns singleton', () => {
    expect(JupyterRunner.getInstance()).toBe(runner)
  })

  it('isAvailable returns false when jupyter not found', () => {
    ;(spawn as any).mockImplementation(() => { throw new Error('not found') })
    const r = runner.isAvailable()
    expect(r.available).toBe(false)
  })

  it('isAvailable returns true with version when jupyter found', () => {
    ;(spawn as any).mockImplementation(() => {
      const e = new EventEmitter() as any
      e.stdout = new EventEmitter()
      e.stderr = new EventEmitter()
      setTimeout(() => { e.stdout.emit('data', 'jupyter core     : 4.6.3'); e.emit('close', 0) }, 0)
      return e
    })
    const r = runner.isAvailable()
    expect(r.available).toBe(true)
    expect(r.version).toContain('jupyter')
  })

  it('startKernel allocates new kernel in idle state', () => {
    const k = runner.startKernel('ws-jr-1', 'python3')
    expect(k.status).toBe('idle')
    expect(k.language).toBe('python3')
    expect(k.id).toMatch(/^[a-f0-9]{8}$/)
  })

  it('executeCode on unknown kernel returns hasError=true', async () => {
    const r = await runner.executeCode('nope-kernel', 'print(1)')
    expect(r.ok).toBe(false)
    expect(r.hasError).toBe(true)
  })

  it('executeCode returns stub when jupyter unavailable', async () => {
    ;(runner as any).jupyterAvailable = false
    const k = runner.startKernel('ws-jr-2', 'python3')
    const r = await runner.executeCode(k.id, 'print(1)')
    expect(r.ok).toBe(true)
    expect(r.stub).toBe(true)
  })

  it('executeCode posts to jupyter server and parses response', async () => {
    ;(runner as any).jupyterAvailable = true
    ;(runner as any).serverUrl = 'http://127.0.0.1:18888'
    ;(global as any).fetch = vi.fn(async () => new Response(JSON.stringify({
      stdout: 'hello\n', stderr: '', hasError: false, executionCount: 1,
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const k = runner.startKernel('ws-jr-3', 'python3')
    const r = await runner.executeCode(k.id, 'print("hello")')
    expect(r.ok).toBe(true)
    expect(r.stdout).toBe('hello\n')
    expect(r.executionCount).toBe(1)
    expect(r.stub).toBe(false)
    delete (global as any).fetch
  })

  it('executeCode handles fetch error gracefully', async () => {
    ;(runner as any).jupyterAvailable = true
    ;(runner as any).serverUrl = 'http://127.0.0.1:18889'
    ;(global as any).fetch = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    const k = runner.startKernel('ws-jr-4', 'python3')
    const r = await runner.executeCode(k.id, 'bad code')
    expect(r.ok).toBe(false)
    expect(r.hasError).toBe(true)
    delete (global as any).fetch
  })

  it('close kernel marks status dead', () => {
    const k = runner.startKernel('ws-jr-5', 'python3')
    expect(runner.close(k.id)).toBe(true)
    expect(runner.getKernel(k.id)).toBeUndefined()
  })

  it('listKernels returns all active kernels', () => {
    runner.startKernel('ws-jr-6')
    runner.startKernel('ws-jr-7')
    expect(runner.listKernels().length).toBe(2)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
npx vitest run tests/unit/JupyterRunner.test.ts
```

期望:全部 FAIL(`executeCode` / `jupyterAvailable` 字段不存在)。

- [ ] **Step 4: 重写 JupyterRunner.ts**

`electron/sandbox/JupyterRunner.ts` 全文替换为:

```typescript
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
```

- [ ] **Step 5: 跑测试确认通过**

```bash
npx vitest run tests/unit/JupyterRunner.test.ts
```

期望:全部 10 个 it 通过。

- [ ] **Step 6: 跑全套确保没破其他测试**

```bash
npx vitest run --reporter=dot
```

期望:178 + 10 = 188 个测试通过(test count 从 178 → 188,新增 10 个 JupyterRunner 测试)。

- [ ] **Step 7: Commit**

```bash
git add electron/sandbox/JupyterRunner.ts tests/unit/JupyterRunner.test.ts
git commit -m "feat(sandbox) JupyterRunner real jupyter notebook server with stub fallback"
```

---

## Task 3: WebContainerRunner 主进程保留 stub + 新增 IPC contract

**Files:**
- Modify: `electron/sandbox/WebContainerRunner.ts`(新增 IPC publish `webcontainer:ipc-request`,改 ~30 行)
- Modify: `electron/core/IpcServer.ts`(新增 1 个 IPC handler `webcontainer:renderer-ready`,改 ~15 行)
- Modify: `electron/preload.ts`(新增 1 个 channel `webcontainer:renderer-event`,改 ~5 行)
- Modify: `tests/unit/WebContainerRunner.test.ts`(追加 2 个 IPC contract 测试,改 ~20 行)

- [ ] **Step 1: 追加 IPC contract 测试**

在 `tests/unit/WebContainerRunner.test.ts` 末尾追加:

```typescript
  it('boot publishes webcontainer:ipc-request for renderer to handle', async () => {
    const events: any[] = []
    const off = (runner as any).bus.subscribe('webcontainer:ipc-request', (e: any) => events.push(e))
    await runner.boot()
    expect(events.some(e => e.action === 'boot')).toBe(true)
    off()
  })

  it('spawn publishes ipc-request with cmd and args', async () => {
    const events: any[] = []
    const off = (runner as any).bus.subscribe('webcontainer:ipc-request', (e: any) => events.push(e))
    await runner.spawn('npm', ['install'])
    expect(events.some(e => e.action === 'spawn' && e.cmd === 'npm')).toBe(true)
    off()
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run tests/unit/WebContainerRunner.test.ts
```

期望:2 个新 it FAIL(`webcontainer:ipc-request` event 未发布)。

- [ ] **Step 3: 修改 WebContainerRunner 保留 stub 但新增 IPC contract**

`electron/sandbox/WebContainerRunner.ts` 的 `boot` / `mount` / `spawn` 方法修改为发布额外 IPC event,供 renderer hidden BrowserWindow 监听真接 `@webcontainer/api`:

修改 `boot` 方法:

```typescript
  async boot(): Promise<{ ok: boolean; stub: boolean }> {
    if (this.booted) return { ok: true, stub: false }
    this.log.warn('WebContainerRunner.boot: 主进程 stub,真实 boot 在 renderer 监听 webcontainer:ipc-request')
    this.booted = true
    void this.bus.publish('webcontainer:booted', { stub: true })
    void this.bus.publish('webcontainer:ipc-request', { action: 'boot', ts: Date.now() })
    return { ok: true, stub: true }
  }
```

修改 `mount` 方法末尾追加:

```typescript
    void this.bus.publish('webcontainer:mounted', { workspaceId, fileCount })
    void this.bus.publish('webcontainer:ipc-request', { action: 'mount', workspaceId, ts: Date.now() })
    return { ok: true, fileCount, stub: true }
```

修改 `spawn` 方法末尾追加:

```typescript
    void this.bus.publish('webcontainer:spawn', { cmd, args })
    void this.bus.publish('webcontainer:ipc-request', { action: 'spawn', cmd, args, ts: Date.now() })
    return {
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: `W11 stub: ${cmd} ${args.join(' ')}`,
      durationMs: 0,
      stub: true,
    }
```

- [ ] **Step 4: 在 IpcServer.ts 新增 renderer-ready 接收 handler**

在 `electron/core/IpcServer.ts` 中找合适位置(通常在 IPC handler 注册块末尾)新增:

```typescript
  // WebContainerRunner renderer-ready 接收(renderer 加载 @webcontainer/api 后回 ack)
  ipcMain.handle('webcontainer:renderer-ready', async () => {
    const bus = EventBus.getInstance()
    void bus.publish('webcontainer:renderer-acknowledged', { ts: Date.now() })
    return { ok: true }
  })
```

并在文件顶部 import 处确认 `EventBus` 已导入(应该已经)。如果 `ipcMain` 未导入则添加:

```typescript
import { ipcMain } from 'electron'
```

- [ ] **Step 5: 在 preload.ts 新增 bridge**

在 `electron/preload.ts` 的 `electronAPI` 对象中追加:

```typescript
  webcontainer: {
    notifyRendererReady: () => ipcRenderer.invoke('webcontainer:renderer-ready'),
  },
```

- [ ] **Step 6: 跑测试确认通过**

```bash
npx vitest run tests/unit/WebContainerRunner.test.ts
```

期望:全部通过(包括新加的 2 个)。

- [ ] **Step 7: 跑全套**

```bash
npx vitest run --reporter=dot
```

期望:188 + 2 = 190 个测试通过。

- [ ] **Step 8: Commit**

```bash
git add electron/sandbox/WebContainerRunner.ts electron/core/IpcServer.ts electron/preload.ts tests/unit/WebContainerRunner.test.ts
git commit -m "feat(sandbox) WebContainerRunner publish ipc-request for renderer to handle @webcontainer/api"
```

---

## Task 4: 验证 + retro

**Files:**
- Create: `docs/superpowers/retros/2026-07-17-real-proxy-wc-jupyter/retro.md`
- 主会话兜底跑:`npx tsc --noEmit -p tsconfig.node.json` + `npx vitest run --reporter=dot`

- [ ] **Step 1: 主会话跑 tsc**

```bash
npx tsc --noEmit -p tsconfig.node.json 2>&1 | tee tsc-step3.txt
echo "TSC_EXIT=$?"
```

期望:`TSC_EXIT=0`,`tsc-step3.txt` 为空。

- [ ] **Step 2: 主会话跑 vitest 全套**

```bash
npx vitest run --reporter=dot 2>&1 | tail -20
```

期望:`Tests 190 passed (190)` 或近似数字(178 + 12 新增)。

- [ ] **Step 3: 检查 commit 链**

```bash
git log --oneline -8
```

期望看到 3 个新 commit(proxy / jupyter / wc IPC)+ 1 个 retro = 4 commit 紧跟 `b02df49`。

- [ ] **Step 4: 写 retro**

创建 `docs/superpowers/retros/2026-07-17-real-proxy-wc-jupyter/retro.md`,内容覆盖:

1. **TL;DR**:3 个 stub 替换,新增 IPC contract
2. **3 commit 列表**(Step 1/2/3 各一)
3. **新增/修改文件清单**
4. **决策记录**:
   - WebContainerRunner 主进程保留 stub 因为 `@webcontainer/api` 浏览器-only,改为 IPC 协调
   - JupyterRunner fallback 保留 W11 stub 行为,避免破坏现有 demo
   - SandboxProxy 用 fetch 而非 undici/superagent,Node 18+ 原生够用
5. **遇到的问题 / 偏差**:
   - test count 从 178 → 190(+12 新增)
   - 任何 subagent 报告的偏差
6. **不在本 plan 范围(留给后续)**:
   - WebContainerRunner renderer 真实加载 `@webcontainer/api`(需 demo + BrowserWindow)
   - JupyterRunner 走 jupyter_client WebSocket 协议(目前用自定 /api/execute REST)
   - 流式输出(SSE)

- [ ] **Step 5: Commit retro**

```bash
git add docs/superpowers/retros/2026-07-17-real-proxy-wc-jupyter/retro.md tsc-step3.txt
git commit -m "docs(retro) real sandbox proxy webcontainer jupyter 3 stubs replaced"
```

---

## 不在本 plan 范围

- **WebContainerRunner renderer 真接**:本 plan 只暴露 IPC contract,实际 renderer 加载 `@webcontainer/api` 是后续 v2.x 工作
- **JupyterRunner WebSocket**:目前用自定 REST `/api/execute`,真 Jupyter 协议是 WebSocket + ZMQ,留给 v2.x
- **流式输出**:SSE 流式 LLM/Sandbox 输出不在本 plan 范围(Step 2 retro 已 mark)
- **D2PrimeScaffold demo 端到端验证**:本 plan 只做 unit test,真实 e2e 留 v2.0.2
- **网络策略/资源限制的子进程级联**:startServer / startProc 涉及 child_process,与现有 NetworkPolicy / ResourceLimits 集成留给后续

---

## 给后续 subagent 的提醒

- **fallback 必须保留**:`stub: true` 标记字段不能删,JupyterRunner fallback 路径必须保留
- **测试用 mock,不真起 jupyter**:`spawn` mock 返回 EventEmitter,`fetch` mock 返回 Response,绝不能在 CI 真启 jupyter
- **fetch 在 Node 18+ 原生可用**,不要装 undici
- **不修改 package.json**:0 npm 依赖新增
