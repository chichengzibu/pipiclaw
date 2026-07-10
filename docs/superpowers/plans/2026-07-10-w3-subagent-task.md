# W3 — 8 能力域骨架 + IPC Namespace Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 3 个 task)
> **执行窗口**:约 45-90 分钟
> **前置 commit**:`e85c145` W2.2 Chat 视觉翻新(已合入 master)
> **目标 commit**:3 个 commit(W3.1 / W3.2 / W3.3)
> **当前工作目录**:`D:\pipiclaw\piclaw`
> **node_modules**:已就位(vitest 可用,typecheck 可用)

> **职责分工**:
> - **subagent**:写 8 个新 .ts 文件 + 改 2 个既有文件(`IpcServer.ts` / `preload.ts`)。**不跑 git**。
> - **主会话(控制器)**:逐 task 验收 → 跑 `git add` + `git commit` → 3 个 commit 落库 → 跑 vitest 71/71 + typecheck 0 错。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W3 章节,做 3 件事:
1. 建 6 个新域根目录 + 6 个 index.ts
2. 建 `electron/contracts/` 域间协议 + `CapabilityRegistry` 类 + 10 Domain 定义
3. 在 IpcServer + preload 追加 4 个新 IPC namespace(agent / channel / sandbox / insight)

---

## 2. 必读现状(动手前先 Read)

| 文件 | 行数 | 重点 |
|---|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` | 30KB | W3 章节(L113-L162)权威任务定义 |
| `docs/superpowers/specs/2026-07-10-pipiclaw-v2-design.md` 段 4 | 1.2KB | 8 能力域蓝图(10 Domain 常量来源) |
| `docs/superpowers/specs/2026-07-10-pipiclaw-v2-design.md` 段 4 "关键接口签名" | 50 行 | AgentBrain / HermesMemory / Skill / Channel / Sandbox / Connector / TraceCollector 接口签名 |
| `electron/chat/ChatManager.ts` | ~600 行 | **1.0.0 真实实现的模式参考** |
| `electron/chat/ChatConfig.ts` | ~50 行 | 单例模式(getInstance)参考 |
| `electron/chat/ChatTypes.ts` | ~150 行 | 类型定义风格参考 |
| `electron/core/IpcServer.ts` | **1592 行** | **只追加不修改**;在 `registerHandlers()` 末尾的 `this.log.info('IPC处理器注册完成')` 之前(行 1570)追加 4 个 namespace 的 `ipcMain.handle(...)` |
| `electron/preload.ts` | 953 行 | IpcChannels(行 14-172) + electronAPI(行 525-943) 都只追加 |

---

## 3. 任务 W3.1 — 6 个新域根目录 + 6 个 index.ts

### 3.1 创建的目录(每个有 .gitkeep + index.ts)

```
electron/agent/
  .gitkeep
  index.ts

electron/contentgen/
  .gitkeep
  index.ts

electron/connector/
  .gitkeep
  index.ts

electron/computeruse/
  .gitkeep
  index.ts

electron/insight/
  .gitkeep
  index.ts

electron/sandbox/
  .gitkeep
  index.ts
```

### 3.2 每个 index.ts 模板

**注意**:plan 写"参考 `electron/chat/index.ts` 1.0.0 已有模式"——**但 1.0.0 实际没有 chat/index.ts**!模式不存在。
正确做法:**用 `electron/chat/ChatManager.ts` 内的 export 模式**(单例 + getInstance)做参考,但**index.ts 只做 re-export**——本期只创建骨架,具体 Manager 类在后续 W5-W8 才实现。

**index.ts 模板**(以 `electron/agent/index.ts` 为例,其他 5 个同构):

```typescript
/**
 * PiPiClaw - Agent 能力域(W3 骨架,具体实现在 W5)
 *
 * 职责:Agent 思维链、并行调度、工具调用循环、子 Agent 派生、上下文压缩等。
 * 入口:AgentBrain(见 spec 段 4 "关键接口签名")。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W5):在此目录下创建 AgentBrain.ts / ParallelScheduler.ts / 等 17 文件。
 */

export const AGENT_DOMAIN = {
  id: 'agent',
  displayName: 'Agent',
  description: '主控 + 思维链 + 工具调用 + 子 Agent 派生',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[], // W5 填充
  dependencies: ['chat', 'memory', 'skill', 'permission', 'task'],
} as const

export type AgentDomainId = typeof AGENT_DOMAIN.id
```

**6 个 index.ts 的 AGENT_DOMAIN id 对应**:
- `agent` → id: 'agent', displayName: 'Agent'
- `contentgen` → id: 'contentgen', displayName: 'Content Generation'
- `connector` → id: 'connector', displayName: 'Connector'
- `computeruse` → id: 'computeruse', displayName: 'Computer Use'
- `insight` → id: 'insight', displayName: 'Insight'
- `sandbox` → id: 'sandbox', displayName: 'P7 Sandbox'

**dependencies 字段**(根据 spec 段 4 接入点):
- `agent`: `['chat', 'memory', 'skill', 'permission', 'task', 'openclaw']`
- `contentgen`: `['agent', 'connector']`
- `connector`: `['agent', 'permission']`
- `computeruse`: `['agent', 'skill', 'browser']`
- `insight`: `[]`  ← **所有域都喂数据,本身不依赖其他域**
- `sandbox`: `['agent', 'insight', 'skill', 'permission']`

### 3.3 自查清单

- [ ] 6 个目录都创建
- [ ] 6 个 index.ts 都按模板写
- [ ] 6 个 .gitkeep 都创建(空文件即可)
- [ ] 未修改任何既有文件
- [ ] 未跑 git
- [ ] 未跑 npm

### 3.4 不需要跑 typecheck(task 内自检即可)

---

## 4. 任务 W3.2 — `electron/contracts/` + `CapabilityRegistry`

### 4.1 创建的文件

```
electron/contracts/
  types.ts
  CapabilityRegistry.ts
```

### 4.2 `electron/contracts/types.ts` 模板(必须遵循 spec 段 4 "关键接口签名")

```typescript
/**
 * PiPiClaw - 能力域间契约(W3 骨架)
 *
 * 域间所有通信必须经过 Capability interface,不允许直接跨域调用内部方法。
 * 本文件只定义接口,实现由各域在 W5-W12 提供。
 */

import type { AgentContext, Decision, ToolCall, ToolResult, SubTask, SubAgent } from '../agent/AgentTypes-placeholder'
// ↑ W5 才有的真实类型,先用 stub,所有方法返回 Promise.resolve 占位

/**
 * 能力(Capability):域内对外暴露的最小可执行单元
 */
export interface Capability {
  /** 能力唯一 id(域内唯一,推荐格式 `<domain>:<verb>`) */
  id: string
  /** 人类可读名(用于 UI 展示) */
  displayName: string
  /** 描述(LLM tool 描述,200 字内) */
  description: string
  /** 执行函数(参数和返回由各 capability 自定义) */
  execute: (args: Record<string, unknown>, ctx: ExecutionContext) => Promise<unknown>
  /** 子能力(嵌套) */
  capabilities?: readonly Capability[]
}

/**
 * 执行上下文(由 CapabilityRegistry 注入)
 */
export interface ExecutionContext {
  /** 当前会话 id(可选) */
  conversationId?: string
  /** 当前用户 id(可选) */
  userId?: string
  /** 权限 token(可选,未设置时 CapabilityRegistry 兜底拒绝) */
  permissionToken?: string
  /** 链路追踪 span(W7 之后填充) */
  trace?: { spanId: string; parentSpanId?: string }
}

/**
 * 域(Domain):一组 Capability 的容器
 */
export interface Domain {
  /** 域 id,与 AGENT_DOMAIN.id 对齐 */
  id: string
  /** 人类可读名 */
  displayName: string
  /** 描述(用于 Insights 页/About 页) */
  description: string
  /** 当前域版本(语义化版本) */
  version: string
  /** 本域暴露的全部 Capability */
  capabilities: readonly Capability[]
  /** 依赖的其他域 id(启动顺序依据) */
  dependencies: readonly string[]
}

/**
 * Agent 域入口(参考 spec 段 4 "关键接口签名")
 */
export interface AgentBrain {
  think(ctx: AgentContext): Promise<Decision>
  call(tool: ToolCall): Promise<ToolResult>
  spawn(subtask: SubTask): Promise<SubAgent>
  checkpoint(): Promise<string>
  restore(id: string): Promise<void>
}

/**
 * Memory 域入口(参考 spec 段 4)
 */
export interface HermesMemory {
  recall(query: string, opts?: RecallOptions): Promise<Memory[]>
  store(memory: Memory): Promise<void>
  curate(): Promise<CuratorReport>
  evolve(): Promise<EvolutionReport>
}

/**
 * Skill 域入口(参考 spec 段 4)
 */
export interface Skill {
  name: string
  signature: string
  execute(input: SkillInput, ctx: SkillContext): Promise<SkillOutput>
}

/**
 * Channel 域入口(参考 spec 段 4)
 */
export interface Channel {
  id: string
  send(msg: ChannelMessage): Promise<void>
  onMessage(handler: MessageHandler): Disposable
  healthCheck(): Promise<ChannelHealth>
}

/**
 * P7 Sandbox 域入口(参考 spec 段 4)
 */
export interface Sandbox {
  execute(cmd: string, opts?: ExecOptions): Promise<ExecResult>
  preview(): Promise<PreviewURL>
  stop(): Promise<void>
  audit(): Promise<AuditEntry[]>
}

/**
 * Connector 域入口(参考 spec 段 4)
 */
export interface Connector {
  id: string
  execute(intent: ConnectorIntent, ctx: ConnectorContext): Promise<ConnectorResult>
}

/**
 * Insight 域入口(参考 spec 段 4)
 */
export interface TraceCollector {
  startSpan(name: string, attrs?: Record<string, unknown>): Span
  endSpan(span: Span, result?: unknown): void
}

// ============ 类型占位(后续 W4-W12 填充) ============

export interface AgentContext { conversationId?: string; [k: string]: unknown }
export interface Decision { action: 'think' | 'call' | 'spawn' | 'stop' | 'reply'; payload: unknown }
export interface ToolCall { name: string; args: Record<string, unknown> }
export interface ToolResult { ok: boolean; data?: unknown; error?: string }
export interface SubTask { instruction: string; parentTaskId?: string }
export interface SubAgent { id: string; brain: AgentBrain }
export interface RecallOptions { topK?: number; minScore?: number }
export interface Memory { id: string; content: string; score?: number; createdAt: number }
export interface CuratorReport { removed: number; promoted: number }
export interface EvolutionReport { newMemories: number; mutated: number }
export interface SkillInput { [k: string]: unknown }
export interface SkillContext { userId?: string; permissionToken?: string }
export interface SkillOutput { ok: boolean; data?: unknown; error?: string }
export interface ChannelMessage { to: string; text?: string; attachments?: unknown[] }
export type MessageHandler = (msg: ChannelMessage) => void | Promise<void>
export interface Disposable { dispose(): void }
export interface ChannelHealth { healthy: boolean; latencyMs?: number; error?: string }
export interface ExecOptions { cwd?: string; env?: Record<string, string>; timeoutMs?: number }
export interface ExecResult { exitCode: number; stdout: string; stderr: string; durationMs: number }
export interface PreviewURL { url: string; port: number; expiresAt: number }
export interface AuditEntry { ts: number; action: string; args?: unknown; result?: 'ok' | 'denied' | 'error' }
export interface ConnectorIntent { verb: string; args: Record<string, unknown> }
export interface ConnectorContext { userId?: string; permissionToken?: string }
export interface ConnectorResult { ok: boolean; data?: unknown; error?: string }
export interface Span { id: string; name: string; startMs: number; endMs?: number; attrs: Record<string, unknown> }
```

### 4.3 `electron/contracts/CapabilityRegistry.ts` 模板

```typescript
/**
 * PiPiClaw - 域间协议注册表(W3 骨架)
 *
 * 职责:
 * 1. 各域启动时调用 register(domain) 把自己挂到 registry
 * 2. LLM Agent / 跨域调用通过 resolve(id) 找到 Capability
 * 3. execute(capabilityId, args, ctx) 执行(包含依赖检查 + 权限校验 + 链路追踪)
 *
 * 本期(W3.2):实现骨架,具体权限/追踪在 W7-W8 接入。
 */

import { LogManager } from '../core/LogManager'
import type { Domain, Capability, ExecutionContext } from './types'

export class CapabilityRegistry {
  private static instance: CapabilityRegistry
  private log = LogManager.getInstance()
  private domains: Map<string, Domain> = new Map()
  private capabilities: Map<string, Capability> = new Map()
  private initialized = false

  private constructor() {}

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry()
    }
    return CapabilityRegistry.instance
  }

  /**
   * 注册一个域(以及其下所有 capabilities)
   * 重复注册同 id 域会覆盖(并打 warn)
   */
  public register(domain: Domain): void {
    if (this.domains.has(domain.id)) {
      this.log.warn(`CapabilityRegistry: 域 ${domain.id} 重复注册,覆盖`)
    }
    this.domains.set(domain.id, domain)
    for (const cap of domain.capabilities) {
      this.capabilities.set(cap.id, cap)
    }
    this.log.info(`CapabilityRegistry: 注册域 ${domain.id} (${domain.capabilities.length} capabilities)`)
  }

  /**
   * 解析一个 capability
   */
  public resolve(capabilityId: string): Capability | undefined {
    return this.capabilities.get(capabilityId)
  }

  /**
   * 列出某域下所有 capability
   */
  public listByDomain(domainId: string): readonly Capability[] {
    return this.domains.get(domainId)?.capabilities ?? []
  }

  /**
   * 列出全部域(用于 Insights 页 / About 页)
   */
  public listDomains(): readonly Domain[] {
    return [...this.domains.values()]
  }

  /**
   * 执行一个 capability
   * W3.2 阶段:只做依赖检查 + 日志
   * W7 之后:加入权限校验 + 链路追踪
   */
  public async execute(
    capabilityId: string,
    args: Record<string, unknown>,
    ctx: ExecutionContext = {}
  ): Promise<unknown> {
    const cap = this.resolve(capabilityId)
    if (!cap) {
      throw new Error(`Capability ${capabilityId} 未注册`)
    }
    // 找 capability 所属域
    const domain = [...this.domains.values()].find(d =>
      d.capabilities.some(c => c.id === capabilityId)
    )
    if (!domain) {
      throw new Error(`Capability ${capabilityId} 所属域未找到`)
    }
    // 依赖检查(递归)
    for (const dep of domain.dependencies) {
      if (!this.domains.has(dep)) {
        this.log.warn(`Capability ${capabilityId} 的依赖域 ${dep} 未注册`)
        // 不 throw,只是 warn,允许部分依赖缺失时仍执行
      }
    }
    this.log.debug(`执行 capability ${capabilityId}`)
    return cap.execute(args, ctx)
  }

  /**
   * 检查启动顺序(返回拓扑排序)
   * 用于 main.ts 启动时按顺序 register 各域
   */
  public getStartupOrder(): readonly string[] {
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (id: string): void => {
      if (visited.has(id)) return
      visited.add(id)
      const dom = this.domains.get(id)
      if (!dom) return
      for (const dep of dom.dependencies) {
        visit(dep)
      }
      order.push(id)
    }

    for (const id of this.domains.keys()) {
      visit(id)
    }
    return order
  }

  /**
   * 重置(测试用)
   */
  public reset(): void {
    this.domains.clear()
    this.capabilities.clear()
    this.initialized = false
  }

  /**
   * 标记初始化完成(main.ts 启动后调用)
   */
  public markInitialized(): void {
    this.initialized = true
    this.log.info(`CapabilityRegistry: 初始化完成,共 ${this.domains.size} 个域, ${this.capabilities.size} 个 capability`)
  }

  public isInitialized(): boolean {
    return this.initialized
  }
}
```

### 4.4 自查清单

- [ ] `electron/contracts/types.ts` 完整实现(spec 段 4 全部 7 个入口接口)
- [ ] `electron/contracts/CapabilityRegistry.ts` 完整实现 8 个方法
- [ ] 未修改任何既有文件
- [ ] 未跑 git
- [ ] 未跑 npm

### 4.5 必须跑 typecheck(确认 contracts 不破坏 typecheck)

```bash
npx vue-tsc --noEmit 2>&1 | head -50
```

**预期**:因为 contracts/ 是纯类型 + 不被任何既有文件 import,0 错误。如果报错,先排查再继续。

---

## 5. 任务 W3.3 — IpcServer + preload 加 4 个新 namespace

### 5.1 必须遵循的现状(实际代码,plan 写错了!)

> plan §W3.3 写"在 IpcServer.ts 末尾加 `registerAgentNamespace()` 等 4 个方法"——**这与 1.0.0 实际不符**。
> 实际:IpcServer 用 `registerHandlers()` 一次性注册,**没有 namespace 函数化**。
> 正确做法:**追加** `ipcMain.handle(...)` 在 `registerHandlers()` 末尾,共享同一种模式。

### 5.2 IpcServer.ts 修改位置

在 `IpcServer.ts` 第 **1569 行**(最后一行 `ipcMain.handle('skills:perform-merge', ...)` 之后)与第 1570 行(`this.log.info('IPC处理器注册完成')`)之间,插入以下 4 段:

#### 5.2.1 agent namespace(3 channel)

```typescript
    // ========== Agent 能力域 (W3 新增) ==========
    ipcMain.handle('agent:think', async (_, ctx: any) => {
      try {
        // W5 才实现 AgentBrain,本期先 stub
        this.log.debug('agent:think stub', { ctx })
        return { success: true, data: { action: 'think', payload: ctx, stub: true } }
      } catch (error) {
        this.log.error('agent:think 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('agent:spawn', async (_, subtask: any) => {
      try {
        this.log.debug('agent:spawn stub', { subtask })
        return { success: true, data: { id: `agent-stub-${Date.now()}`, stub: true } }
      } catch (error) {
        this.log.error('agent:spawn 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('agent:list', async () => {
      try {
        const reg = require('../contracts/CapabilityRegistry').CapabilityRegistry.getInstance()
        return { success: true, data: reg.listDomains() }
      } catch (error) {
        this.log.error('agent:list 失败', error)
        return { success: false, error: String(error) }
      }
    })
```

#### 5.2.2 channel namespace(3 channel)

```typescript
    // ========== Channel 能力域 (W3 新增) ==========
    ipcMain.handle('channel:list', async () => {
      try {
        // W7 才实现 ChannelRouter,本期先返回空数组
        return { success: true, data: [] as Array<{ id: string; name: string; healthy: boolean }> }
      } catch (error) {
        this.log.error('channel:list 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('channel:health', async (_, channelId: string) => {
      try {
        return { success: true, data: { healthy: true, latencyMs: 0, stub: true, channelId } }
      } catch (error) {
        this.log.error('channel:health 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('channel:send', async (_, msg: { channelId: string; to: string; text?: string }) => {
      try {
        this.log.debug('channel:send stub', { msg })
        return { success: true, data: { messageId: `msg-stub-${Date.now()}`, stub: true } }
      } catch (error) {
        this.log.error('channel:send 失败', error)
        return { success: false, error: String(error) }
      }
    })
```

#### 5.2.3 sandbox namespace(4 channel)

```typescript
    // ========== P7 Sandbox 能力域 (W3 新增) ==========
    ipcMain.handle('sandbox:detect', async () => {
      try {
        // W9 才实现 SandboxBuilder,本期先 stub:返回 host 平台 + docker 是否可用(用 which 探测)
        const { execSync } = require('node:child_process')
        let dockerAvailable = false
        try {
          execSync('docker --version', { stdio: 'ignore' })
          dockerAvailable = true
        } catch {}
        return {
          success: true,
          data: {
            platform: process.platform,
            arch: process.arch,
            dockerAvailable,
            sandboxRoot: require('node:os').homedir() + '/.pipiclaw/sandbox',
            stub: true
          }
        }
      } catch (error) {
        this.log.error('sandbox:detect 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('sandbox:run', async (_, cmd: string, opts: any) => {
      try {
        this.log.debug('sandbox:run stub', { cmd, opts })
        return { success: true, data: { exitCode: 0, stdout: 'sandbox:run stub', stderr: '', durationMs: 0, stub: true } }
      } catch (error) {
        this.log.error('sandbox:run 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('sandbox:preview', async () => {
      try {
        return { success: true, data: { url: '', port: 0, expiresAt: 0, stub: true } }
      } catch (error) {
        this.log.error('sandbox:preview 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('sandbox:stop', async () => {
      try {
        return { success: true, data: { stub: true } }
      } catch (error) {
        this.log.error('sandbox:stop 失败', error)
        return { success: false, error: String(error) }
      }
    })
```

#### 5.2.4 insight namespace(3 channel)

```typescript
    // ========== Insight 能力域 (W3 新增) ==========
    ipcMain.handle('insight:trace:start', async (_, name: string, attrs: Record<string, unknown>) => {
      try {
        const spanId = `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        this.log.debug(`insight:trace:start ${spanId}`, { name, attrs })
        return { success: true, data: { spanId, name, startMs: Date.now(), attrs, stub: true } }
      } catch (error) {
        this.log.error('insight:trace:start 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('insight:trace:end', async (_, spanId: string) => {
      try {
        this.log.debug(`insight:trace:end ${spanId}`)
        return { success: true, data: { spanId, endMs: Date.now(), stub: true } }
      } catch (error) {
        this.log.error('insight:trace:end 失败', error)
        return { success: false, error: String(error) }
      }
    })

    ipcMain.handle('insight:cost:today', async () => {
      try {
        return { success: true, data: { totalCostUsd: 0, totalTokens: 0, stub: true } }
      } catch (error) {
        this.log.error('insight:cost:today 失败', error)
        return { success: false, error: String(error) }
      }
    })
```

### 5.3 preload.ts 修改位置

#### 5.3.1 在 IpcChannels 对象(行 14-172)末尾、closing `} as const` 之前,追加 4 个 namespace 的常量

```typescript
  // ========== Agent 能力域 (W3 新增) ==========
  AGENT_THINK: 'agent:think',
  AGENT_SPAWN: 'agent:spawn',
  AGENT_LIST: 'agent:list',

  // ========== Channel 能力域 (W3 新增) ==========
  CHANNEL_LIST: 'channel:list',
  CHANNEL_HEALTH: 'channel:health',
  CHANNEL_SEND: 'channel:send',

  // ========== P7 Sandbox 能力域 (W3 新增) ==========
  SANDBOX_DETECT: 'sandbox:detect',
  SANDBOX_RUN: 'sandbox:run',
  SANDBOX_PREVIEW: 'sandbox:preview',
  SANDBOX_STOP: 'sandbox:stop',

  // ========== Insight 能力域 (W3 新增) ==========
  INSIGHT_TRACE_START: 'insight:trace:start',
  INSIGHT_TRACE_END: 'insight:trace:end',
  INSIGHT_COST_TODAY: 'insight:cost:today',
```

#### 5.3.2 在 electronAPI 对象(行 525-943)末尾、`learning: { ... }` 之后,追加 4 个 namespace

```typescript
  // ========== Agent 能力域 (W3 新增) ==========
  agent: {
    think: (ctx: Record<string, unknown>): Promise<IpcResponse<{ action: string; payload: unknown; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.AGENT_THINK, ctx),
    spawn: (subtask: { instruction: string; parentTaskId?: string }): Promise<IpcResponse<{ id: string; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.AGENT_SPAWN, subtask),
    list: (): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke(IpcChannels.AGENT_LIST)
  },

  // ========== Channel 能力域 (W3 新增) ==========
  channel: {
    list: (): Promise<IpcResponse<Array<{ id: string; name: string; healthy: boolean }>>> =>
      ipcRenderer.invoke(IpcChannels.CHANNEL_LIST),
    health: (channelId: string): Promise<IpcResponse<{ healthy: boolean; latencyMs: number; stub: boolean; channelId: string }>> =>
      ipcRenderer.invoke(IpcChannels.CHANNEL_HEALTH, channelId),
    send: (msg: { channelId: string; to: string; text?: string }): Promise<IpcResponse<{ messageId: string; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.CHANNEL_SEND, msg)
  },

  // ========== P7 Sandbox 能力域 (W3 新增) ==========
  sandbox: {
    detect: (): Promise<IpcResponse<{ platform: NodeJS.Platform; arch: string; dockerAvailable: boolean; sandboxRoot: string; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.SANDBOX_DETECT),
    run: (cmd: string, opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number }): Promise<IpcResponse<{ exitCode: number; stdout: string; stderr: string; durationMs: number; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.SANDBOX_RUN, cmd, opts),
    preview: (): Promise<IpcResponse<{ url: string; port: number; expiresAt: number; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.SANDBOX_PREVIEW),
    stop: (): Promise<IpcResponse<{ stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.SANDBOX_STOP)
  },

  // ========== Insight 能力域 (W3 新增) ==========
  insight: {
    traceStart: (name: string, attrs?: Record<string, unknown>): Promise<IpcResponse<{ spanId: string; name: string; startMs: number; attrs: Record<string, unknown>; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.INSIGHT_TRACE_START, name, attrs),
    traceEnd: (spanId: string): Promise<IpcResponse<{ spanId: string; endMs: number; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.INSIGHT_TRACE_END, spanId),
    costToday: (): Promise<IpcResponse<{ totalCostUsd: number; totalTokens: number; stub: boolean }>> =>
      ipcRenderer.invoke(IpcChannels.INSIGHT_COST_TODAY)
  }
```

### 5.4 自查清单

- [ ] IpcServer.ts 新增 13 个 `ipcMain.handle` 调用(3 agent + 3 channel + 4 sandbox + 3 insight)
- [ ] IpcServer.ts 没有修改任何已有 handler,只在末尾追加
- [ ] IpcServer.ts 没有删除任何已有 import
- [ ] preload.ts IpcChannels 新增 13 个常量
- [ ] preload.ts electronAPI 新增 4 个 namespace
- [ ] preload.ts 没有修改任何已有 namespace
- [ ] `npx vue-tsc --noEmit` 0 错(必须)
- [ ] `npx vitest run` 71/71 仍通过(必须)

### 5.5 必须跑

```bash
npx vue-tsc --noEmit 2>&1 | tail -20
npx vitest run 2>&1
```

---

## 6. subagent 工作流

```
W3.1:
  1. mkdir 6 个目录(用 bash 或 Write 自带 mkdir)
  2. Write 6 个 .gitkeep(空内容即可)
  3. Write 6 个 index.ts(按 3.2 模板)
  4. 自查清单(3.3)

W3.2:
  1. Write electron/contracts/types.ts(按 4.2)
  2. Write electron/contracts/CapabilityRegistry.ts(按 4.3)
  3. 自查清单(4.4)
  4. 跑 `npx vue-tsc --noEmit 2>&1 | head -50`,确认 0 错

W3.3:
  1. Edit IpcServer.ts(按 5.2,在 L1569 与 L1570 之间插入 4 段)
  2. Edit preload.ts(按 5.3.1 在 IpcChannels 末尾插入 13 常量;按 5.3.2 在 electronAPI 末尾插入 4 namespace)
  3. 自查清单(5.4)
  4. 跑 `npx vue-tsc --noEmit 2>&1 | tail -20`,确认 0 错
  5. 跑 `npx vitest run 2>&1`,确认 71/71 通过

报告:6 项(见 §7)
```

---

## 7. 完成报告(返回内容)

1. **3 task 的 diff 统计**(`git diff --stat`,只针对 `git status` 出现的文件)
2. **新建文件清单**(8 个新 .ts + 6 个 .gitkeep)
3. **修改文件清单**(`IpcServer.ts` 增 N 行 / `preload.ts` 增 N 行,确认行数对齐)
4. **typecheck 结果**(`vue-tsc --noEmit` 输出,必须 0 错)
5. **vitest 结果**(必须 71/71)
6. **遇到难题 + 决策**(如 IpcServer.ts 实际行数与 plan 不符,如何处理)
7. **遗留未改项**

---

## 8. 禁止事项

- **不跑 git**(主会话统一)
- **不跑 npm**(主会话统一)
- **不删除**任何文件
- **不重命名**任何文件
- **不修改**既有 IPC handler / 既有 preload namespace / 既有 import
- **不引入**任何 npm 依赖
- **不修改** `electron/gateway/`(已删)
- **不修改** 任何 view / component / store / router

---

## 9. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git status --short` 确认改动只在 8 个新 .ts + 6 个 .gitkeep + IpcServer.ts + preload.ts
2. `git diff --stat` 看改动规模(IpcServer.ts 应 +100-130 行,preload.ts 应 +70-90 行)
3. 跑 `npx vue-tsc --noEmit`,必须 0 错
4. 跑 `npx vitest run`,必须 71/71
5. 3 个 commit 落库(W3.1 / W3.2 / W3.3)
6. 报告 W3 整体结果
