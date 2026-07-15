# W9 — P7 沙盒基础 Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 4 task)
> **执行窗口**:约 30-60 分钟
> **前置 commit**:`d91ecdc` W8 docs(已合入 master)
> **目标 commit**:4 commit + 1 docs commit = **5 commit 全部由 subagent 自 commit**(短英文 message)
> **当前工作目录**:`D:\pipiclaw\piclaw`

> **职责分工**:
> - **subagent**:写 10 个新文件,4 个 commit。**主会话只跑兜底测试 + 验收**,subagent 自己 git add + git commit。
> - **关键变更**:subagent 直接 commit(短 message,避免含特殊符号)

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W9 章节(L488-L550),做 4 件事:

| Task | 模块 | 文件 | commit |
|---|---|---|---|
| W9.1 | dockerDetector | electron/sandbox/dockerDetector.ts | 1 |
| W9.2 | L1 隔离 3 平台 | SandboxL1.ts + l1/seatbelt.ts + l1/bwrap.ts + l1/windowsJob.ts | 1 |
| W9.3 | workspace 抽象 | workspace.ts | 1 |
| W9.4 | base 镜像 | sandbox/base/Dockerfile + scripts/sandbox-base-build.mjs + package.json 改 | 1 |
| **合计** | | **10 新文件 + 1 改** | **4** |

---

## 2. 必读现状(关键)

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W9 章节(L488-L550) | 权威定义 |
| `electron/sandbox/index.ts`(W3.1 骨架) | W3.1 只有空 re-export,本任务不修改 |
| `electron/sandbox/.gitkeep` | 空目录标识 |
| `electron/contracts/types.ts` | Sandbox / Connector 接口(已定义,本任务不修改) |
| `package.json` | 当前 scripts: dev/build/build:win/preview/postinstall/typecheck/lint/test/test:watch/test:coverage |
| `electron/agent/ToolSandboxAdapter.ts`(W5.2.4) | ToolSandboxAdapter.mode='process/docker/webcontainer' 已经在 Agent 域用过,本任务不修改 |
| `electron/skill/SkillSandboxStub.ts`(W6.2b) | SkillSandboxStub.level='none/process/docker/webcontainer' 已经在 skill 域用过,本任务不修改 |

**关键约束**:
1. **不引入新 npm 依赖**。dockerDetector 走 `child_process.execSync('docker ...')` 原生。
2. **只探测,不安装**——W9.1 plan 明确。
3. **3 平台 L1 隔离**:
   - macOS:`sandbox-exec`(系统自带,macOS 12+ 仍存在)
   - Linux:`bwrap`(需 bubblewrap,W9 阶段:探测到就用,否则 stub)
   - Windows:Job Object(plan 明确"留占位")
4. **路径注意**:
   - `electron/sandbox/`(W9.1-W9.3 业务代码)
   - `sandbox/base/Dockerfile`(W9.4 镜像定义,**仓库根 sandbox/ 目录,不是 electron/sandbox/**)
   - `scripts/sandbox-base-build.mjs`(W9.4 build 脚本)
5. **W9.4 末尾追加** `package.json` scripts:`"sandbox:build-base": "node scripts/sandbox-base-build.mjs"`(additive,既有 scripts 0 改动)
6. **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts / 既有 view / 既有 sandbox 业务代码(W3.1 index.ts 0 改动)。
7. **W9 阶段不真跑 docker build**——只写 Dockerfile + build 脚本。**build 命令在子任务提示中明确写"W9 阶段未实跑,需用户在有 docker 的环境下手动验证"**。

---

## 3. 总体原则

- **4 个 commit 顺序执行**,每个完成后跑 `npx tsc --noEmit` + `npx vitest run` 验证
- **不引入新 npm 依赖**
- **commit message 短**(避免含特殊符号 `():`-`,`)
- **每 commit 自己跑 + 自己 add + 自己 commit**

---

## 4. Task W9.1 — `dockerDetector.ts`(1 commit)

### 4.1 文件清单

```
electron/sandbox/dockerDetector.ts    (~150 行)
```

### 4.2 实现

```typescript
import { LogManager } from '../core/LogManager'
import { execSync } from 'node:child_process'
import * as os from 'node:os'

export type DockerStatus =
  | 'available'                    // docker 装了 + daemon 跑了 + compose 可用
  | 'available-no-compose'         // docker 装了 + daemon 跑了 + compose 不可用
  | 'not-installed'                // docker 命令找不到
  | 'daemon-down'                  // docker 装了但 daemon 没跑
  | 'permission-denied'            // /var/run/docker.sock 无权限
  | 'unsupported'                  // 当前平台不支持

export interface DockerDetectResult {
  status: DockerStatus
  /** docker version 字符串(如 "Docker version 24.0.7, build ...")*/
  version?: string
  /** 错误详情(若 status != 'available')*/
  error?: string
  /** 当前平台 */
  platform: NodeJS.Platform
  /** 安装 URL(若 not-installed) */
  installUrl?: string
}

export class DockerDetector {
  private static instance: DockerDetector
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): DockerDetector {
    if (!DockerDetector.instance) DockerDetector.instance = new DockerDetector()
    return DockerDetector.instance
  }

  /**
   * 探测 docker 状态。W9 阶段:只探测,不安装。
   * 走 3 步:docker --version → docker info → docker compose version
   */
  async detect(): Promise<DockerDetectResult> {
    const platform = os.platform() as NodeJS.Platform
    const result: DockerDetectResult = { status: 'unsupported', platform }

    if (platform === 'win32') {
      // 简化:Windows 暂不实现(W9 优先 macOS/Linux)
      result.status = 'unsupported'
      result.error = 'Windows 平台 W9 暂不实装,W10+ 评估'
      return result
    }

    // 1. docker --version
    let version: string
    try {
      version = execSync('docker --version', { encoding: 'utf-8', timeout: 5000 }).trim()
    } catch (e) {
      this.log.info('DockerDetector: docker --version fail', e)
      result.status = 'not-installed'
      result.error = String((e as Error).message ?? e)
      result.installUrl = this.installUrlFor(platform)
      return result
    }
    result.version = version

    // 2. docker info(测 daemon)
    try {
      const info = execSync('docker info 2>&1', { encoding: 'utf-8', timeout: 5000 })
      if (info.toLowerCase().includes('permission denied') || info.toLowerCase().includes('cannot connect')) {
        result.status = 'permission-denied'
        result.error = info.slice(0, 200)
        return result
      }
    } catch (e) {
      const msg = (e as any).stderr?.toString() ?? String((e as Error).message ?? e)
      this.log.info('DockerDetector: docker info fail', msg)
      if (msg.toLowerCase().includes('permission denied')) {
        result.status = 'permission-denied'
        result.error = msg.slice(0, 200)
        return result
      }
      result.status = 'daemon-down'
      result.error = msg.slice(0, 200)
      return result
    }

    // 3. docker compose version
    try {
      execSync('docker compose version', { encoding: 'utf-8', timeout: 5000 })
      result.status = 'available'
    } catch (e) {
      this.log.info('DockerDetector: docker compose version fail', e)
      result.status = 'available-no-compose'
    }

    return result
  }

  /**
   * 返回官方 docker 安装 URL
   * 不实际触发安装,只返回链接供 UI 显示
   */
  installUrlFor(platform: NodeJS.Platform): string {
    switch (platform) {
      case 'darwin':
        return 'https://docs.docker.com/desktop/install/mac-install/'
      case 'linux':
        return 'https://docs.docker.com/engine/install/'
      case 'win32':
        return 'https://docs.docker.com/desktop/install/windows-install/'
      default:
        return 'https://www.docker.com/get-docker/'
    }
  }

  /**
   * 健康检查(给 UI 用)
   * 返回 { status, summary }
   */
  async healthCheck(): Promise<{ status: DockerStatus; summary: string }> {
    const r = await this.detect()
    const summaryMap: Record<DockerStatus, string> = {
      'available': 'Docker 可用',
      'available-no-compose': 'Docker 可用但 docker compose 不可用',
      'not-installed': `Docker 未安装,前往 ${this.installUrlFor(r.platform)}`,
      'daemon-down': 'Docker daemon 未运行',
      'permission-denied': 'Docker socket 无权限',
      'unsupported': `当前平台 ${r.platform} W9 暂不支持`,
    }
    return { status: r.status, summary: summaryMap[r.status] }
  }
}
```

### 4.3 自查清单

- [ ] 1 个新文件
- [ ] 6 种 DockerStatus:available / available-no-compose / not-installed / daemon-down / permission-denied / unsupported
- [ ] installUrlFor(platform) 返回正确 URL(mac/linux/win)
- [ ] detect() 走 3 步:docker --version → docker info → docker compose version
- [ ] W9 阶段不真安装
- [ ] tsc 0 错

### 4.4 commit

```bash
git add electron/sandbox/dockerDetector.ts
git commit -m "feat(sandbox) dockerDetector 6-state probe plus install URL"
```

---

## 5. Task W9.2 — L1 隔离 3 平台(1 commit)

### 5.1 文件清单

```
electron/sandbox/SandboxL1.ts       (~150 行)
electron/sandbox/l1/seatbelt.ts     (~80 行,macOS)
electron/sandbox/l1/bwrap.ts        (~80 行,Linux)
electron/sandbox/l1/windowsJob.ts   (~50 行,Windows 占位)
```

### 5.2 `l1/seatbelt.ts`(macOS sandbox-exec)

```typescript
import { LogManager } from '../../core/LogManager'
import { execFileSync } from 'node:child_process'
import * as os from 'node:os'

/**
 * macOS sandbox-exec L1 隔离
 * sandbox-exec 是 macOS 系统自带(12+ 仍存在,15+ deprecated 但可用)
 * 通过 SBPL profile 限制进程权限:deny-write / deny-network / allow-read-only
 */
export interface SeatbeltProfile {
  /** 允许读(系统只读) */
  readonly allowReadPaths: string[]
  /** 允许写(workspace) */
  readonly allowWritePaths: string[]
  /** 允许网络出口 */
  readonly allowNetwork: boolean
  /** 允许进程派生 */
  readonly allowProcessFork: boolean
}

export function buildSeatbeltProfile(opts: SeatbeltProfile): string {
  const lines: string[] = ['(version 1)', '(deny default)']
  // 系统读取
  lines.push('(allow process-exec)')
  lines.push('(allow process-fork)' + (opts.allowProcessFork ? '' : ' (deny)'))
  lines.push('(allow sysctl-read)')
  lines.push('(allow system-socket)')
  // 允许读
  for (const p of opts.allowReadPaths) {
    lines.push(`(allow file-read* (subpath "${p}"))`)
  }
  // 允许写
  for (const p of opts.allowWritePaths) {
    lines.push(`(allow file-write* (subpath "${p}"))`)
  }
  // 网络
  if (opts.allowNetwork) {
    lines.push('(allow network*)')
  } else {
    lines.push('(deny network*)')
  }
  return lines.join('\n')
}

export interface SeatbeltRunResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export function runWithSeatbelt(profile: string, command: string[], cwd?: string): SeatbeltRunResult {
  const log = LogManager.getInstance()
  const startMs = Date.now()
  try {
    const stdout = execFileSync('sandbox-exec', ['-p', profile, ...command], {
      encoding: 'utf-8',
      cwd,
      timeout: 30_000,
    })
    return { ok: true, exitCode: 0, stdout, stderr: '', durationMs: Date.now() - startMs }
  } catch (e: any) {
    return {
      ok: false,
      exitCode: e.status ?? 1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
      durationMs: Date.now() - startMs,
    }
  }
}

export function isSeatbeltAvailable(): boolean {
  return os.platform() === 'darwin'
}
```

### 5.3 `l1/bwrap.ts`(Linux bubblewrap)

```typescript
import { LogManager } from '../../core/LogManager'
import { execFileSync } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Linux bwrap L1 隔离
 * bwrap 是 bubblewrap(需 sudo apt install bubblewrap)
 * bwrap --ro-bind / --bind $cwd --unshare-net --unshare-pid -- <cmd>
 */
export interface BwrapOptions {
  /** 工作目录(默认 cwd) */
  cwd?: string
  /** 限制网络 */
  unshareNetwork?: boolean
  /** 限制 PID 命名空间 */
  unsharePid?: boolean
  /** 内存限制(MB) */
  memoryMb?: number
}

export function isBwrapAvailable(): boolean {
  if (os.platform() !== 'linux') return false
  try {
    execFileSync('bwrap', ['--version'], { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

export function buildBwrapArgs(opts: BwrapOptions): string[] {
  const args: string[] = []
  // 1. 只读 bind /
  args.push('--ro-bind', '/', '/')
  // 2. bind 写入工作目录
  const cwd = opts.cwd ?? process.cwd()
  args.push('--bind', cwd, cwd)
  // 3. /tmp
  args.push('--tmpfs', '/tmp')
  // 4. unshare 命名空间
  if (opts.unshareNetwork !== false) args.push('--unshare-net')
  if (opts.unsharePid !== false) args.push('--unshare-pid')
  // 5. env pass-through
  args.push('--setenv', 'PATH', process.env.PATH ?? '/usr/bin:/bin')
  // 6. working dir
  args.push('--chdir', cwd)
  return args
}

export interface BwrapRunResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  fallback: boolean  // bwrap 不可用,降级 stub
}

export function runWithBwrap(command: string[], opts: BwrapOptions = {}): BwrapRunResult {
  const log = LogManager.getInstance()
  const startMs = Date.now()

  if (!isBwrapAvailable()) {
    log.warn('Bwrap: 不可用,降级 stub(W9 阶段不阻断)')
    return { ok: true, exitCode: 0, stdout: '', stderr: 'bwrap not available, fallback stub', durationMs: 0, fallback: true }
  }

  try {
    const args = [...buildBwrapArgs(opts), '--', ...command]
    const stdout = execFileSync('bwrap', args, { encoding: 'utf-8', timeout: 30_000 })
    return { ok: true, exitCode: 0, stdout, stderr: '', durationMs: Date.now() - startMs, fallback: false }
  } catch (e: any) {
    return {
      ok: false,
      exitCode: e.status ?? 1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
      durationMs: Date.now() - startMs,
      fallback: false,
    }
  }
}
```

### 5.4 `l1/windowsJob.ts`(Windows Job Object 占位)

```typescript
import { LogManager } from '../../core/LogManager'
import * as os from 'node:os'

/**
 * Windows Job Object L1 隔离(占位,W9 plan 明确"留占位")
 * 真实实现:win32job npm 库 + JobObject + UiFlags
 * W9 阶段:仅接口定义 + isAvailable 检测
 */
export function isWindowsJobAvailable(): boolean {
  return os.platform() === 'win32'
}

export interface WindowsJobConfig {
  /** CPU 限制(0-100) */
  cpuLimit?: number
  /** 内存限制(MB) */
  memoryMb?: number
  /** 子进程派生 */
  allowChildProcesses?: boolean
}

export interface WindowsJobResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  fallback: boolean
}

export function runWithWindowsJob(command: string[], config: WindowsJobConfig = {}): WindowsJobResult {
  const log = LogManager.getInstance()
  const startMs = Date.now()
  log.warn('WindowsJob: W9 stub,Windows 平台 W9 暂不实装,W10+ 评估')
  return {
    ok: true,
    exitCode: 0,
    stdout: '',
    stderr: 'Windows Job Object W9 stub',
    durationMs: Date.now() - startMs,
    fallback: true,
  }
}
```

### 5.5 `SandboxL1.ts`(统一入口)

```typescript
import { LogManager } from '../core/LogManager'
import * as os from 'node:os'
import { isSeatbeltAvailable, runWithSeatbelt, buildSeatbeltProfile, SeatbeltRunResult, SeatbeltProfile } from './l1/seatbelt'
import { isBwrapAvailable, runWithBwrap, BwrapOptions, BwrapRunResult } from './l1/bwrap'
import { isWindowsJobAvailable, runWithWindowsJob, WindowsJobConfig, WindowsJobResult } from './l1/windowsJob'

export type L1Mode = 'seatbelt' | 'bwrap' | 'windows-job' | 'stub'

export interface L1Options {
  /** 平台自动选择(W9 阶段) */
  mode?: L1Mode
  /** 沙箱内允许读路径 */
  allowReadPaths?: string[]
  /** 沙箱内允许写路径 */
  allowWritePaths?: string[]
  /** 是否允许网络 */
  allowNetwork?: boolean
  /** cwd */
  cwd?: string
  /** Linux 专属 */
  memoryMb?: number
  /** Windows 专属 */
  cpuLimit?: number
  allowProcessFork?: boolean
}

export interface L1Result {
  ok: boolean
  mode: L1Mode
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  fallback: boolean
}

/**
 * SandboxL1: 3 平台 L1 进程隔离统一入口
 * 自动按平台选择 isolation mechanism:
 *   macOS → sandbox-exec
 *   Linux → bwrap (bubblewrap)
 *   Windows → Job Object (W9 stub)
 */
export class SandboxL1 {
  private static instance: SandboxL1
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxL1 {
    if (!SandboxL1.instance) SandboxL1.instance = new SandboxL1()
    return SandboxL1.instance
  }

  /** 当前平台支持的 L1 mode */
  currentMode(): L1Mode {
    if (isSeatbeltAvailable()) return 'seatbelt'
    if (isBwrapAvailable()) return 'bwrap'
    if (isWindowsJobAvailable()) return 'windows-job'
    return 'stub'
  }

  /** 探测 L1 能力 */
  capability(): { mode: L1Mode; available: boolean; reason?: string } {
    const mode = this.currentMode()
    if (mode === 'stub') {
      return { mode: 'stub', available: false, reason: `平台 ${os.platform()} W9 不支持 L1 隔离` }
    }
    if (mode === 'seatbelt') return { mode: 'seatbelt', available: true }
    if (mode === 'bwrap') return { mode: 'bwrap', available: true }
    return { mode: 'windows-job', available: false, reason: 'W9 stub' }
  }

  /** 跑命令(自动选 L1 mode) */
  run(command: string[], opts: L1Options = {}): L1Result {
    const mode = opts.mode ?? this.currentMode()
    this.log.info(`SandboxL1: mode=${mode} cmd=${command.join(' ')}`)
    switch (mode) {
      case 'seatbelt': {
        const profile: SeatbeltProfile = {
          allowReadPaths: opts.allowReadPaths ?? ['/usr', '/System', '/Library'],
          allowWritePaths: opts.allowWritePaths ?? [opts.cwd ?? process.cwd()],
          allowNetwork: opts.allowNetwork ?? false,
          allowProcessFork: opts.allowProcessFork ?? true,
        }
        const r = runWithSeatbelt(buildSeatbeltProfile(profile), command, opts.cwd)
        return { ok: r.ok, mode, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, durationMs: r.durationMs, fallback: false }
      }
      case 'bwrap': {
        const r = runWithBwrap(command, { cwd: opts.cwd, unshareNetwork: !opts.allowNetwork, unsharePid: true, memoryMb: opts.memoryMb })
        return { ok: r.ok, mode, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, durationMs: r.durationMs, fallback: r.fallback }
      }
      case 'windows-job': {
        const r = runWithWindowsJob(command, { cpuLimit: opts.cpuLimit, memoryMb: opts.memoryMb, allowChildProcesses: opts.allowProcessFork })
        return { ok: r.ok, mode, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, durationMs: r.durationMs, fallback: r.fallback }
      }
      case 'stub':
        return { ok: false, mode, exitCode: 1, stdout: '', stderr: 'L1 隔离不可用', durationMs: 0, fallback: true }
    }
  }
}
```

### 5.6 自查清单

- [ ] 4 个文件齐全
- [ ] seatbelt.ts:buildSeatbeltProfile + runWithSeatbelt + isSeatbeltAvailable
- [ ] bwrap.ts:isBwrapAvailable 检测 + runWithBwrap 降级 stub
- [ ] windowsJob.ts:仅占位,W9 stub
- [ ] SandboxL1.ts:currentMode() / capability() / run() 3 平台分发
- [ ] tsc 0 错

### 5.7 commit

```bash
git add electron/sandbox/SandboxL1.ts electron/sandbox/l1/
git commit -m "feat(sandbox) L1 process isolation seatbelt bwrap windows-job"
```

---

## 6. Task W9.3 — workspace 抽象(1 commit)

### 6.1 文件清单

```
electron/sandbox/workspace.ts    (~150 行)
```

### 6.2 实现

```typescript
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
 * WorkspaceManager: sandbox workspace 抽象
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

  /** 列出所有 workspace */
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
      this.log.warn(`WorkspaceManager: delete ${id} fs fail`, e)
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

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        const arr = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as Workspace[]
        for (const w of arr) this.workspaces.set(w.id, w)
      }
    } catch (e) {
      this.log.warn('WorkspaceManager: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify([...this.workspaces.values()], null, 2))
    } catch (e) {
      this.log.warn('WorkspaceManager: persist failed', e)
    }
  }
}
```

### 6.3 自查清单

- [ ] 1 个新文件
- [ ] createWorkspace / listWorkspaces / getWorkspace / deleteWorkspace
- [ ] hostPath = `app.getPath('userData')/sandboxes/{id}/mnt`
- [ ] containerPath = `/mnt/data`(固定)
- [ ] toContainerPath / toHostPath 双向转换
- [ ] 持久化到 userData/sandboxes/index.json
- [ ] tsc 0 错

### 6.4 commit

```bash
git add electron/sandbox/workspace.ts
git commit -m "feat(sandbox) workspace abstraction host path to mnt data"
```

---

## 7. Task W9.4 — base 镜像 Dockerfile + build 脚本(1 commit)

### 7.1 文件清单

| 文件 | 状态 | 行数 |
|---|---|---|
| `sandbox/base/Dockerfile` | 新建 | ~50 行 |
| `scripts/sandbox-base-build.mjs` | 新建 | ~50 行 |
| `package.json` | **末尾追加 1 script** | +1 行 |

### 7.2 `sandbox/base/Dockerfile`

```dockerfile
# PiPiClaw sandbox base image
# W9 plan: ubuntu:24.04 + node 22 + python 3.12 + java 21 + go 1.23 + 国内镜像源

FROM ubuntu:24.04

LABEL maintainer="PiPiClaw" version="1.0.0"

# ============ 1. 系统包 ============
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget git build-essential \
    locales tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8 zh_CN.UTF-8
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# ============ 2. 国内镜像源(npm / pip / maven / go) ============
RUN npm config set registry https://registry.npmmirror.com \
    && pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    || true

# ============ 3. Node 22 ============
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_VERSION=22

# ============ 4. Python 3.12 ============
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
ENV PYTHON_VERSION=3.12

# ============ 5. Java 21 ============
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jdk \
    && rm -rf /var/lib/apt/lists/*
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# ============ 6. Go 1.23 ============
ARG GO_VERSION=1.23.4
RUN curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz -o /tmp/go.tar.gz \
    && rm -rf /usr/local/go \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz
ENV PATH=/usr/local/go/bin:$PATH GOPROXY=https://goproxy.cn,direct

# ============ 7. 工作目录(与 workspace.containerPath=/mnt/data 一致) ============
WORKDIR /mnt/data

# ============ 8. 验证(可选,build 时不强制跑) ============
# RUN node --version && python3 --version && java -version && go version
```

### 7.3 `scripts/sandbox-base-build.mjs`

```javascript
#!/usr/bin/env node
/**
 * PiPiClaw sandbox base image build 脚本
 * 用法: pnpm sandbox:build-base  或  node scripts/sandbox-base-build.mjs
 * 
 * W9 阶段:脚本只打印 docker build 命令,不真跑(避免 W9 阶段没有 docker 的环境阻塞)
 * 后续可加 --run 开关真触发 build
 */
import { execSync } from 'node:child_process'

const IMAGE_NAME = 'pipiclaw/sandbox-base'
const IMAGE_TAG = 'latest'
const DOCKERFILE = 'sandbox/base/Dockerfile'

console.log(`[sandbox-base-build]`)
console.log(`  IMAGE  : ${IMAGE_NAME}:${IMAGE_TAG}`)
console.log(`  CONTEXT: sandbox/base/`)
console.log(`  FILE   : ${DOCKERFILE}`)
console.log()

const args = ['build', '-t', `${IMAGE_NAME}:${IMAGE_TAG}`, '-f', DOCKERFILE, 'sandbox/base/']
console.log(`[cmd] docker ${args.join(' ')}`)
console.log()

const runNow = process.argv.includes('--run')
if (runNow) {
  console.log('[run-now] 真执行 docker build...')
  try {
    execSync(`docker ${args.join(' ')}`, { stdio: 'inherit' })
    console.log('[ok] 镜像构建成功')
  } catch (e) {
    console.error(`[fail] ${e.message}`)
    process.exit(1)
  }
} else {
  console.log('[info] 当前为 dry-run 模式(只打印命令,未真执行)')
  console.log('[info] 如要真跑 docker build,加 --run 标志:')
  console.log('       pnpm sandbox:build-base -- --run')
}
```

### 7.4 末尾追加 package.json script

读 `package.json`,在 `scripts` 对象末尾追加 1 个(保留既有 scripts 0 改动):

```json
  "sandbox:build-base": "node scripts/sandbox-base-build.mjs",
```

(注意:加在最末尾,**`};` 之前**,逗号接上一个 script)

### 7.5 自查清单

- [ ] sandbox/base/Dockerfile:ubuntu 24.04 + 4 语言 + 国内镜像源
- [ ] scripts/sandbox-base-build.mjs:默认 dry-run,`--run` 真跑
- [ ] package.json 末尾追加 1 个 `sandbox:build-base` script
- [ ] 既有的 10 个 scripts 0 改动
- [ ] tsc 0 错

### 7.6 commit

```bash
git add sandbox/base/Dockerfile scripts/sandbox-base-build.mjs package.json
git commit -m "feat(sandbox) self-built base image ubuntu 24.04 4 langs cn mirrors"
```

---

## 8. subagent 工作流

```
1. Read 任务指令(本文件)
2. cd D:\pipiclaw\piclaw
3. 跑 git status 确认干净
4. Read 关键文件校准:
   - electron/sandbox/index.ts(W3.1 既有,不修改)
   - electron/contracts/types.ts(Sandbox 接口,本任务不修改)
   - package.json(读 scripts 块)
   - electron/agent/ToolSandboxAdapter.ts / electron/skill/SkillSandboxStub.ts(本任务不修改)
5. W9.1: 写 dockerDetector.ts → tsc + vitest → 1 commit
6. W9.2: 写 SandboxL1.ts + 3 l1/* 文件 → tsc + vitest → 1 commit
7. W9.3: 写 workspace.ts → tsc + vitest → 1 commit
8. W9.4: 写 Dockerfile + build 脚本 + 末尾追加 1 package script → tsc + vitest → 1 commit
9. 最终报告
```

---

## 9. 完成报告(返回内容)

1. **4 commit hash**(从 git log --oneline -4 读)
2. tsc 错误数(应保持 0)
3. vitest 通过数(应保持 84)
4. electron/sandbox/ 目录文件总数(应 9 个:.gitkeep + index.ts + dockerDetector + SandboxL1 + 3 l1/* + workspace)
5. 仓库根目录新文件:`sandbox/base/Dockerfile` + `scripts/sandbox-base-build.mjs`
6. 关键决策 / 难题 / 遗留未改项

---

## 10. 禁止事项

- **不引入** 任何新 npm 依赖
- **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts
- **不修改** 既有 view / component / store / SideNav
- **不修改** electron/sandbox/index.ts / .gitkeep(W3.1 既有)
- **不修改** 既有 ToolSandboxAdapter / SkillSandboxStub
- **不修改** package.json 既有 10 个 scripts(只末尾追加 1)
- **不真跑** docker build(W9 阶段脚本默认 dry-run)
- **不删除** / 不重命名任何文件
- **不跑 npm install**

---

## 11. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git log --oneline -5` 看 4 commit + 1 docs
2. `npx vitest run` 确认 84/84
3. `npx tsc --noEmit` 确认 0 错
4. 报告 W9 整体结果