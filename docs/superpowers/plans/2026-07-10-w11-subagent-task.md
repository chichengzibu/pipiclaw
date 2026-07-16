# W11 — P7 预览 + 端口转发 + Jupyter + D2-Prime 旗舰 demo Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 5 task)
> **执行窗口**:约 60-90 分钟
> **前置 commit**:`f01a0c0` W10 docs(已合入 master)
> **目标 commit**:5 commit + 1 docs commit = **6 commit 全部由 subagent 自 commit**(短英文 message)
> **当前工作目录**:`D:\pipiclaw\piclaw`

> **职责分工**:
> - **subagent**:写 7 个新文件 + 2 改(package.json + router),5 个 commit。**主会话只跑兜底测试 + 验收**,subagent 自己 git add + git commit。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W11 章节(L602-L680),做 5 件事:

| Task | 模块 | 文件 | commit |
|---|---|---|---|
| W11.1 | WebContainerRunner | WebContainerRunner.ts + package.json 末尾追加 1 dep | 1 |
| W11.2 | PortForwarder + proxy | PortForwarder.ts + proxy.ts | 1 |
| W11.3 | JupyterRunner | JupyterRunner.ts | 1 |
| W11.4 | Lifecycle + AgentTool | SandboxLifecycle.ts + SandboxAgentTool.ts | 1 |
| W11.5 | D2-Prime 旗舰 demo | D2PrimeScaffold.ts + D2PrimeDemo.vue + router 末尾追加 1 route | 1 |
| **合计** | | **7 新文件 + 2 改** | **5** |

---

## 2. 必读现状(关键)

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W11 章节(L602-L680) | 权威定义 |
| `electron/sandbox/`(W9-W10 完成) | 已有 16 个 .ts 业务文件:`dockerDetector / SandboxL1 / l1/{seatbelt,bwrap,windowsJob} / workspace / SandboxBuilder / templates/{6 files} / networkPolicy / resourceLimits` |
| `electron/sandbox/SandboxBuilder.ts` W10.1 | `build(opts)` 返回 `BuildResult { workspace, template, fileCount }`,W11.5 D2-Prime 复用 |
| `electron/sandbox/WorkspaceManager` W9.3 | `createWorkspace / listWorkspaces / getWorkspace / toContainerPath / toHostPath`,W11 Lifecycle 复用 |
| `electron/agent/AgentBrain.ts` W5.2.2 | AgentBrain 5 方法 think/call/spawn/checkpoint/restore,W11.4 SandboxAgentTool 复用 |
| `electron/skill/builtin/D1ScreenshotQA.ts` W5.3 + `D3RemoteCommand.ts` W7.4 + `D5RecordingToSkill.ts` W6.4 + `A5ComputerUse.ts` W8.2 | builtin 参考模式,W11.5 D2PrimeScaffold 参照 |
| `src/router/index.ts`(W7-W10 累计) | 既有 16 route,W11.5 末尾追加 1 个 `/d2-prime-demo` |
| `package.json` | 当前 dependencies 含 `docx 8.5.0`,W11.1 末尾追加 1 dep `@webcontainer/api` |

**关键约束**:
1. **W11.1 是项目内首次引入新运行时依赖**(`@webcontainer/api`),plan §W11.1 明确允许。其他 4 个 task **不引入新依赖**。
2. **WebContainerRunner 必须在主进程能 import**(虽然实际只能在浏览器跑,W11 阶段 stub)。
3. **JupyterRunner** 走 subprocess spawn `python -m jupyter`(W11 阶段只检查 jupyter 是否可用,不真起 kernel)。
4. **W11.5 D2-Prime demo 默认走 stub**(类似 A5 / D3),**不真跑 WebContainer**,W12+ 真接。
5. **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts / 既有 view / 既有 sandbox 业务代码(W10 16 文件 0 改动)。
6. **W11.5 末尾追加** `src/router/index.ts` 1 route(`/d2-prime-demo`),既有 16 routes 0 改动。
7. **W11.1 末尾追加** `package.json` 1 dep `@webcontainer/api`(不指定版本,用 `latest`)。
8. **每 commit 自己跑 + 自己 add + 自己 commit**(短英文 message,避免含特殊符号 `():`-`,`)
9. **W11 阶段不真跑 docker / WebContainer / jupyter**——所有 runner 都 stub。

---

## 3. 总体原则

- **5 个 commit 顺序执行**,每个完成后跑 `npx tsc --noEmit` + `npx vitest run` 验证
- **只 W11.1 引入 1 个新 dep**:`@webcontainer/api`
- **commit message 短**(避免含特殊符号 `():`-`,`)

---

## 4. Task W11.1 — `WebContainerRunner.ts`(1 commit)

### 4.1 文件清单

```
electron/sandbox/WebContainerRunner.ts    (~200 行)
package.json    (末尾追加 1 dep "@webcontainer/api": "latest")
```

### 4.2 实现

```typescript
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
  /** 公开 URL(本任务 stub:返回 placeholder) */
  url: string
  ts: number
}

type ServerReadyHandler = (e: ServerReadyEvent) => void

/**
 * WebContainerRunner: 集成 @webcontainer/api(浏览器内零容器前端运行时)
 * 
 * W11 阶段:stub 实现,所有方法 log.warn + 返回 stub 标记。
 * 实际 WebContainer 只能在浏览器跑(主进程无法直接 import),
 * 真实集成需要 BrowserWindow 加载特殊 renderer,W12+ 评估。
 * 
 * 引入 @webcontainer/api 只是为了让 types 存在,代码能 import。
 */
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

  /** boot */
  async boot(): Promise<{ ok: boolean; stub: boolean }> {
    if (this.booted) return { ok: true, stub: false }
    this.log.warn('WebContainerRunner.boot: W11 stub,真实 boot 需 BrowserWindow 加载 webcontainer api,W12+ 评估')
    this.booted = true
    void this.bus.publish('webcontainer:booted', { stub: true })
    return { ok: true, stub: true }
  }

  /** mount workspace 的文件树 */
  async mount(workspaceId: string): Promise<{ ok: boolean; fileCount: number; stub: boolean }> {
    const ws = this.workspaceManager.getWorkspace(workspaceId)
    if (!ws) return { ok: false, fileCount: 0, stub: true }
    this.mountedWorkspaceId = workspaceId
    // 走 fs.readdir 计数
    const fileCount = await this.countFiles(ws.hostPath)
    this.log.info(`WebContainerRunner.mount: ${workspaceId} (${fileCount} files, stub)`)
    void this.bus.publish('webcontainer:mounted', { workspaceId, fileCount })
    return { ok: true, fileCount, stub: true }
  }

  /** spawn 命令(stub) */
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

  /** 订阅 server-ready 事件 */
  onServerReady(handler: ServerReadyHandler): { dispose: () => void } {
    this.serverReadyHandlers.push(handler)
    return {
      dispose: () => {
        const idx = this.serverReadyHandlers.indexOf(handler)
        if (idx >= 0) this.serverReadyHandlers.splice(idx, 1)
      },
    }
  }

  /** 内部:WebContainer 报 ready 时调用 */
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
```

### 4.3 package.json 末尾追加 1 dep

读 `package.json`,在 dependencies 对象末尾追加:

```json
    "@webcontainer/api": "latest"
```

(注意逗号接上一个 dep,`};` 之前)

### 4.4 自查清单

- [ ] 1 个新文件 + 1 改(package.json 末尾追加 1 dep)
- [ ] WebContainerRunner 含 boot / mount / spawn / onServerReady
- [ ] 所有方法 log.warn 标识 W11 stub
- [ ] tsc 0 错(注意:`@webcontainer/api` 是新增 dep,需确保 import 路径正确;**类型可能不全**,必要时 `// @ts-expect-error` 或 `as any`)

### 4.5 commit

```bash
git add electron/sandbox/WebContainerRunner.ts package.json
git commit -m "feat(sandbox) WebContainerRunner integration stub for frontend SPA"
```

---

## 5. Task W11.2 — `PortForwarder.ts` + `proxy.ts`(1 commit)

### 5.1 文件清单

```
electron/sandbox/PortForwarder.ts    (~150 行)
electron/sandbox/proxy.ts           (~80 行)
```

### 5.2 `proxy.ts`

```typescript
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
}

/**
 * proxy: 简单的 HTTP 转发层
 * W11 阶段:stub(返回 200 placeholder)
 * W12+ 接 superagent / undici 真转发
 */
export class SandboxProxy {
  private static instance: SandboxProxy
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxProxy {
    if (!SandboxProxy.instance) SandboxProxy.instance = new SandboxProxy()
    return SandboxProxy.instance
  }

  async forward(req: ProxyRequest, targetUrl: string): Promise<ProxyResponse> {
    this.log.warn(`SandboxProxy.forward: W11 stub (${req.method} ${req.url} → ${targetUrl})`)
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: `<html><body><h1>W11 stub proxy</h1><p>${req.method} ${req.url}</p></body></html>`,
      durationMs: 0,
    }
  }
}
```

### 5.3 `PortForwarder.ts`

```typescript
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

/**
 * PortForwarder: 端口转发,把容器内端口映射到 host 端口 + URL
 * W11 阶段:host 端口从 4000 开始递增分配,真转发逻辑 stub(由 SandboxProxy 兜底)
 */
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

  /** forward 容器端口到 host */
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

  /** 列出所有转发 */
  listForwarded(): ForwardEntry[] {
    return [...this.entries.values()]
  }

  /** 查单个 */
  getForward(id: string): ForwardEntry | undefined {
    return this.entries.get(id)
  }

  /** 关闭转发 */
  closeForward(id: string): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    this.usedHostPorts.delete(e.hostPort)
    this.entries.delete(id)
    void this.bus.publish('port:closed', { id, hostPort: e.hostPort })
    return true
  }

  /** 关闭某 workspace 的所有转发 */
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

  /** 通过转发代理 HTTP 请求(stub) */
  async proxy(id: string, req: { method: string; url: string; headers: Record<string, string>; body?: string }): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
    const e = this.entries.get(id)
    if (!e) return { statusCode: 404, body: 'forward not found', headers: {} }
    return this.proxy.forward(req, `http://localhost:${e.containerPort}`)
  }

  /** 分配 host 端口(避免与已用冲突) */
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
```

### 5.4 自查清单

- [ ] 2 个新文件
- [ ] PortForwarder.forwardPort 分配 host 端口(从 4000 起递增)
- [ ] PortForwarder.listForwarded / closeForward / closeWorkspace
- [ ] SandboxProxy.forward stub 实现
- [ ] tsc 0 错

### 5.5 commit

```bash
git add electron/sandbox/PortForwarder.ts electron/sandbox/proxy.ts
git commit -m "feat(sandbox) PortForwarder plus proxy stub for iframe preview"
```

---

## 6. Task W11.3 — `JupyterRunner.ts`(1 commit)

### 6.1 文件清单

```
electron/sandbox/JupyterRunner.ts    (~120 行)
```

### 6.2 实现

```typescript
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
```

### 6.3 自查清单

- [ ] 1 个新文件
- [ ] JupyterRunner.isAvailable 探测 jupyter 命令
- [ ] startKernel / execute / close / listKernels / getKernel
- [ ] execute W11 stub
- [ ] tsc 0 错

### 6.4 commit

```bash
git add electron/sandbox/JupyterRunner.ts
git commit -m "feat(sandbox) JupyterRunner kernel stub for script exec"
```

---

## 7. Task W11.4 — `SandboxLifecycle.ts` + `SandboxAgentTool.ts`(1 commit)

### 7.1 文件清单

```
electron/sandbox/SandboxLifecycle.ts    (~120 行)
electron/sandbox/SandboxAgentTool.ts    (~100 行)
```

### 7.2 `SandboxLifecycle.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { WorkspaceManager } from './workspace'
import { ResourceLimitsManager } from './resourceLimits'
import { PortForwarder } from './PortForwarder'
import { WebContainerRunner } from './WebContainerRunner'

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

/**
 * SandboxLifecycle: 自动 stop idle / cleanup 老的 sandbox
 * W11 阶段:配置 + 调度器(每分钟检查一次),不真停(只 log)
 */
export class SandboxLifecycle {
  private static instance: SandboxLifecycle
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private workspaceManager = WorkspaceManager.getInstance()
  private resourceLimits = ResourceLimitsManager.getInstance()
  private portForwarder = PortForwarder.getInstance()
  private webContainer = WebContainerRunner.getInstance()
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
    this.checkInterval = setInterval(() => this.check(), 60 * 1000)  // 每分钟
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
      // 1. idle stop
      if (this.config.enableIdleStop && state.status !== 'idle' && state.status !== 'stopped' && now - state.lastUsedAt >= idleMs) {
        this.log.warn(`SandboxLifecycle: idle stop ${id}`)
        state.status = 'idle'
        // 关闭关联资源
        this.portForwarder.closeWorkspace(id)
        this.resourceLimits.release(id)
        void this.bus.publish('sandbox:idle-stopped', { workspaceId: id })
        idleStopped += 1
      }
      // 2. cleanup(超过 cleanupHours)
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

  /** 列出所有 sandbox 状态 */
  listStates(): SandboxState[] {
    return [...this.states.values()]
  }
}
```

### 7.3 `SandboxAgentTool.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { SandboxBuilder } from './SandboxBuilder'
import { Lifecycle, ResourceLimitsManager, NetworkPolicy } from './index'
import { SandboxLifecycle } from './SandboxLifecycle'

/**
 * SandboxAgentTool: 把 p7_scaffold_project 暴露为 Agent 工具
 * 调用流程:
 * 1. SandboxBuilder.build({ prompt }) → workspace
 * 2. SandboxLifecycle.touch(workspaceId)
 * 3. 返回 BuildResult 给 Agent
 */
export class SandboxAgentTool {
  private static instance: SandboxAgentTool
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private builder = SandboxBuilder.getInstance()
  private lifecycle = SandboxLifecycle.getInstance()
  private resourceLimits = ResourceLimitsManager.getInstance()
  private networkPolicy = NetworkPolicy.getInstance()

  private constructor() {}

  public static getInstance(): SandboxAgentTool {
    if (!SandboxAgentTool.instance) SandboxAgentTool.instance = new SandboxAgentTool()
    return SandboxAgentTool.instance
  }

  /** Tool 名 + 描述(供 AgentBrain.call 调度) */
  readonly name = 'p7_scaffold_project'
  readonly description = 'P7 沙盒项目脚手架:接受 prompt,自动选模板,生成 workspace。返回 { workspaceId, templateId, fileCount }'

  /** 工具元信息(供 Agent UI 显示) */
  readonly metadata = {
    requiresPermission: true,
    category: 'sandbox' as const,
    inputSchema: {
      prompt: { type: 'string', description: '用户自然语言描述', required: true },
      templateId: { type: 'string', description: '显式指定模板 (vite-react-ts/nextjs-app/fastapi/go-http)', required: false },
    },
  }

  /** Agent 调用入口 */
  async call(args: { prompt: string; templateId?: string }): Promise<{ ok: boolean; workspaceId?: string; templateId?: string; fileCount?: number; error?: string }> {
    this.log.info(`SandboxAgentTool.call: ${args.prompt.slice(0, 60)}`)
    // 1. 资源申请
    const placeholderWorkspaceId = 'pending-' + Date.now()
    const acquire = this.resourceLimits.acquire(placeholderWorkspaceId)
    if (!acquire.ok) {
      return { ok: false, error: acquire.reason }
    }
    try {
      // 2. 资源限额 + 网络策略检查
      if (this.networkPolicy.isBlockAll()) {
        return { ok: false, error: '网络被全局阻断,无法生成项目' }
      }
      // 3. 调用 SandboxBuilder
      const result = await this.builder.build({
        prompt: args.prompt,
        templateId: args.templateId as any,
      })
      if (!result.ok || !result.workspace) {
        return { ok: false, error: result.error }
      }
      // 4. lifecycle touch
      this.lifecycle.touch(result.workspace.id)
      // 5. 释放 placeholder
      this.resourceLimits.release(placeholderWorkspaceId)
      // 6. 真 workspace 申请资源
      this.resourceLimits.acquire(result.workspace.id)
      void this.bus.publish('agent-tool:sandbox:scaffolded', { workspaceId: result.workspace.id, templateId: result.template?.id })
      return {
        ok: true,
        workspaceId: result.workspace.id,
        templateId: result.template?.id,
        fileCount: result.fileCount,
      }
    } catch (e) {
      this.resourceLimits.release(placeholderWorkspaceId)
      return { ok: false, error: String(e) }
    }
  }
}
```

### 7.4 自查清单

- [ ] 2 个新文件
- [ ] SandboxLifecycle.start / stop / touch / check(每分钟跑)/ getConfig / setConfig / listStates
- [ ] 默认配置:idle 30min / cleanup 24h
- [ ] SandboxAgentTool.call 走"acquire → network check → builder → lifecycle touch → release placeholder"流程
- [ ] tsc 0 错

### 7.5 commit

```bash
git add electron/sandbox/SandboxLifecycle.ts electron/sandbox/SandboxAgentTool.ts
git commit -m "feat(sandbox) lifecycle idle 30min cleanup 24h plus agent tool"
```

---

## 8. Task W11.5 — D2-Prime 旗舰 demo(1 commit)

### 8.1 文件清单

```
electron/skill/builtin/D2PrimeScaffold.ts    (~200 行)
src/views/D2PrimeDemo.vue                    (~400 行)
src/router/index.ts                          (末尾追加 1 route)
```

### 8.2 `D2PrimeScaffold.ts`

```typescript
import { LogManager } from '../../core/LogManager'
import { SandboxBuilder } from '../../sandbox/SandboxBuilder'
import { SandboxLifecycle } from '../../sandbox/SandboxLifecycle'
import { PortForwarder } from '../../sandbox/PortForwarder'
import { WebContainerRunner } from '../../sandbox/WebContainerRunner'
import { EventBus } from '../../runtime/bridge/EventBus'

export const D2_PRIME_SKILL_NAME = 'd2:prime-scaffold'

export interface D2PrimeInput {
  /** 用户自然语言,例如 "做一个 Vite + React + TS 博客" */
  prompt: string
  /** 是否走 WebContainer (前端类项目默认 true) */
  useWebContainer?: boolean
}

export interface D2PrimeResult {
  ok: boolean
  workspaceId?: string
  templateId?: string
  fileCount?: number
  forwardId?: string
  forwardUrl?: string
  /** 预计启动时间(W11 stub,前端类 30s / 后端类 5min) */
  estimatedStartSeconds?: number
  durationMs: number
  error?: string
}

/**
 * D2PrimeScaffold: D2-Prime 项目骨架搭建 demo(旗舰)
 * 流程:
 * 1. 解析 prompt
 * 2. 调用 SandboxBuilder 选模板 + 建 workspace + 写文件
 * 3. SandboxLifecycle.touch(workspaceId)
 * 4. 后端类模板 → PortForwarder.forwardPort + 启 docker(W11 stub)
 *    前端类模板 → WebContainerRunner.boot + mount(W11 stub)
 * 5. 返回 forwardId + url 供 renderer iframe 预览
 */
export async function runD2Prime(input: D2PrimeInput): Promise<D2PrimeResult> {
  const log = LogManager.getInstance()
  const builder = SandboxBuilder.getInstance()
  const lifecycle = SandboxLifecycle.getInstance()
  const forwarder = PortForwarder.getInstance()
  const wc = WebContainerRunner.getInstance()
  const startMs = Date.now()

  try {
    log.info(`D2PrimeScaffold: ${input.prompt.slice(0, 60)}`)

    // 1. 选模板 + 建 workspace
    const buildResult = await builder.build({ prompt: input.prompt })
    if (!buildResult.ok || !buildResult.workspace || !buildResult.template) {
      return { ok: false, durationMs: Date.now() - startMs, error: buildResult.error ?? 'build failed' }
    }

    // 2. lifecycle touch
    lifecycle.touch(buildResult.workspace.id)

    // 3. 判断是否前端类模板
    const isFrontend = ['vite-react-ts', 'nextjs-app'].includes(buildResult.template.id)
    const useWebContainer = input.useWebContainer ?? isFrontend

    // 4. 分配端口
    const forwardResult = forwarder.forwardPort(buildResult.template.devPort, buildResult.workspace.id)
    if (!forwardResult.ok || !forwardResult.entry) {
      return { ok: false, workspaceId: buildResult.workspace.id, templateId: buildResult.template.id, fileCount: buildResult.fileCount, durationMs: Date.now() - startMs, error: forwardResult.error }
    }

    // 5. W11 stub:不真跑,只 log
    let estimatedStartSeconds = 0
    if (useWebContainer) {
      const boot = await wc.boot()
      await wc.mount(buildResult.workspace.id)
      estimatedStartSeconds = 30
      log.info(`D2PrimeScaffold: WebContainer boot=${boot.stub} mount=${buildResult.workspace.id}`)
    } else {
      estimatedStartSeconds = 300
      log.info(`D2PrimeScaffold: docker stub for ${buildResult.template.id}`)
    }

    void EventBus.getInstance().publish('d2-prime:scaffolded', {
      workspaceId: buildResult.workspace.id,
      templateId: buildResult.template.id,
      fileCount: buildResult.fileCount,
      useWebContainer,
      forwardUrl: forwardResult.entry.url,
    })

    return {
      ok: true,
      workspaceId: buildResult.workspace.id,
      templateId: buildResult.template.id,
      fileCount: buildResult.fileCount,
      forwardId: forwardResult.entry.id,
      forwardUrl: forwardResult.entry.url,
      estimatedStartSeconds,
      durationMs: Date.now() - startMs,
    }
  } catch (e) {
    log.error('D2PrimeScaffold: 失败', e)
    return { ok: false, durationMs: Date.now() - startMs, error: String(e) }
  }
}

export const d2PrimeSkillHandler = {
  name: D2_PRIME_SKILL_NAME,
  description: 'D2-Prime 旗舰 demo:30s 内出预览',
  requiresPermission: true,
  async execute(args: D2PrimeInput) {
    return runD2Prime(args)
  },
}

/** W11.5 wire:由 main.ts 调用,把 D2-Prime skill 注册到 SkillRuntime */
export function registerD2PrimeSkill(): void {
  const { SkillRuntime } = require('../../runtime/skill/SkillRuntime')
  SkillRuntime.getInstance().register({
    name: D2_PRIME_SKILL_NAME,
    description: 'D2-Prime 项目骨架搭建(P7 旗舰)',
    handler: async (args: any) => runD2Prime(args as D2PrimeInput),
  })
}
```

### 8.3 `src/views/D2PrimeDemo.vue`

```vue
<template>
  <div class="d2-prime-demo">
    <h2>D2-Prime 旗舰 Demo</h2>
    <p class="d2-hint">输入自然语言 → AI 解析 → 自动选模板 → 沙盒脚手架 → 端口转发 → 预览</p>

    <el-card class="d2-controls">
      <div class="d2-row">
        <el-input v-model="prompt" placeholder="例如:做一个 Vite + React + TS 博客" />
      </div>
      <div class="d2-row">
        <el-checkbox v-model="useWebContainer">优先 WebContainer(前端类)</el-checkbox>
      </div>
      <div class="d2-row d2-actions">
        <el-button type="primary" @click="runDemo" :loading="isRunning" :disabled="!canRun">
          启动 D2-Prime
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastResult?.ok" class="d2-result">
      <h3>脚手架结果</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="workspaceId">{{ lastResult.workspaceId }}</el-descriptions-item>
        <el-descriptions-item label="templateId">{{ lastResult.templateId }}</el-descriptions-item>
        <el-descriptions-item label="fileCount">{{ lastResult.fileCount }}</el-descriptions-item>
        <el-descriptions-item label="forwardUrl">{{ lastResult.forwardUrl }}</el-descriptions-item>
        <el-descriptions-item label="estimatedStartSeconds">{{ lastResult.estimatedStartSeconds }}s</el-descriptions-item>
        <el-descriptions-item label="durationMs">{{ lastResult.durationMs }}ms</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="lastResult?.ok && lastResult.forwardUrl" class="d2-preview">
      <h3>预览</h3>
      <iframe :src="lastResult.forwardUrl" class="d2-iframe" sandbox="allow-scripts allow-same-origin" />
      <p class="d2-preview-note">iframe 预览(W11 stub,实际由 PortForwarder 提供 HTTP,内部走 WebContainer 或 docker)</p>
    </el-card>

    <el-card v-if="lastResult && !lastResult.ok" class="d2-error">
      <h3>失败</h3>
      <p class="d2-error-text">{{ lastResult.error }}</p>
    </el-card>

    <el-card class="d2-flow">
      <h3>流程</h3>
      <ol class="d2-steps">
        <li>解析 prompt <code>{{ prompt || '(空)' }}</code></li>
        <li>SandboxBuilder 选模板 <code>{{ lastResult?.templateId ?? '(待运行)' }}</code></li>
        <li>SandboxLifecycle.touch(workspaceId)</li>
        <li>PortForwarder.forwardPort → {{ lastResult?.forwardUrl ?? '(待运行)' }}</li>
        <li>{{ useWebContainer ? 'WebContainerRunner boot+mount (前端零容器)' : 'docker stub (后端类)' }}</li>
        <li>iframe 预览</li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const prompt = ref('做一个 Vite + React + TS 博客')
const useWebContainer = ref(true)
const isRunning = ref(false)
const lastResult = ref<{
  ok: boolean
  workspaceId?: string
  templateId?: string
  fileCount?: number
  forwardId?: string
  forwardUrl?: string
  estimatedStartSeconds?: number
  durationMs?: number
  error?: string
} | null>(null)

const canRun = computed(() => prompt.value.trim().length > 0)

async function runDemo() {
  isRunning.value = true
  try {
    // W11 stub:直接模拟一次脚手架
    await new Promise(r => setTimeout(r, 200))
    const matchedFrontend = /vite|react|next|前端|spa/i.test(prompt.value)
    const templateId = matchedFrontend ? (useWebContainer.value ? 'vite-react-ts' : 'nextjs-app') : 'fastapi'
    lastResult.value = {
      ok: true,
      workspaceId: 'ws-' + Date.now(),
      templateId,
      fileCount: 6,
      forwardId: 'fwd-' + Date.now(),
      forwardUrl: 'http://localhost:4000',
      estimatedStartSeconds: useWebContainer.value ? 30 : 300,
      durationMs: 180,
    }
  } finally {
    isRunning.value = false
  }
}
</script>

<style lang="scss" scoped>
.d2-prime-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d2-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.d2-row {
  margin-bottom: var(--space-md, 16px);
}

.d2-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.d2-result, .d2-preview, .d2-error, .d2-flow {
  margin-top: var(--space-lg, 24px);
}

.d2-iframe {
  width: 100%;
  height: 480px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--radius-sm, 4px);
}

.d2-preview-note {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-caption-1, 11px);
  margin-top: var(--space-sm, 8px);
}

.d2-error-text {
  color: #c92a2a;
}

.d2-steps {
  padding-left: var(--space-lg, 24px);
  font-size: var(--font-size-body, 14px);
  line-height: 1.8;
}

code {
  background: var(--card-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-caption-1, 11px);
}
</style>
```

### 8.4 末尾追加 D2-Prime 路由

读 `src/router/index.ts`,在 routes 数组末尾(W8.2 既有 `/a5-demo` 之后)追加 1 个:

```typescript
  {
    path: '/d2-prime-demo',
    name: 'D2PrimeDemo',
    component: () => import('@/views/D2PrimeDemo.vue'),
  },
```

**注意**:既有 16 routes 0 改动,只末尾追加 1 个,共 17。

### 8.5 自查清单

- [ ] 2 个新文件 + 1 改(末尾追加 1 route)
- [ ] D2PrimeScaffold.runD2Prime 编排 SandboxBuilder + Lifecycle + PortForwarder + WebContainer
- [ ] 前端类模板(vite/nextjs)优先 WebContainer,后端类 docker stub
- [ ] D2PrimeDemo.vue 用 Element Plus + Apple HIG tokens + iframe 预览
- [ ] tsc 0 错

### 8.6 commit

```bash
git add electron/skill/builtin/D2PrimeScaffold.ts src/views/D2PrimeDemo.vue src/router/index.ts
git commit -m "feat(demo) D2-Prime P7 flagship scaffold"
```

---

## 9. subagent 工作流

```
1. Read 任务指令(本文件)
2. cd D:\pipiclaw\piclaw
3. 跑 git status 确认干净
4. Read 关键文件校准:
   - electron/sandbox/ 目录(W10 16 文件齐全)
   - package.json dependencies(W11.1 末尾追加 1 dep)
   - src/router/index.ts(W8.2 既有 16 route,末尾追加 1 个)
5. W11.1: 写 WebContainerRunner + 末尾追加 1 dep → tsc + vitest → 1 commit
6. W11.2: 写 PortForwarder + proxy → tsc + vitest → 1 commit
7. W11.3: 写 JupyterRunner → tsc + vitest → 1 commit
8. W11.4: 写 Lifecycle + AgentTool → tsc + vitest → 1 commit
9. W11.5: 写 D2PrimeScaffold + D2PrimeDemo + 末尾追加 1 route → tsc + vitest → 1 commit
10. 最终报告
```

---

## 10. 完成报告(返回内容)

1. **5 commit hash**(从 git log --oneline -5 读)
2. tsc 错误数(应保持 0)
3. vitest 通过数(应保持 84)
4. electron/sandbox/ 目录文件总数(应从 16 → 21:16 既有 + 4 W11(2 new + 1 WebContainer + 1 Jupyter) + 2 SandboxLifecycle + SandboxAgentTool = 21)
5. router 改后 route 数(16 → 17)
6. package.json 末尾追加 1 dep `@webcontainer/api`
7. 关键决策 / 难题 / 遗留未改项

---

## 11. 禁止事项

- **只 W11.1 引入** 1 个新依赖 `@webcontainer/api`(其他 4 task 严禁引入)
- **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts
- **不修改** 既有 view / component / store / SideNav
- **不修改** 既有 sandbox 业务代码(W10 16 文件 0 改动)
- **不修改** package.json 既有 dependencies(只末尾追加 1)
- **不修改** 既有 W7.0.2 / W7.4 / W8.2 router(共 16,末尾追加 1 = 17)
- **不删除** / 不重命名任何文件
- **不跑 npm install**(subagent 只 git add 修改后的 package.json)

---

## 12. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git log --oneline -6` 看 5 commit + 1 docs
2. `npx vitest run` 确认 84/84
3. `npx tsc --noEmit` 确认 0 错
4. `npm install` 装 `@webcontainer/api`(主会话接管)
5. 报告 W11 整体结果