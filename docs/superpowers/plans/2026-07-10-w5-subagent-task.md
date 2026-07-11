# W5 — Insight 域 + Agent 域 + D1 截屏问答 Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 3 个 task + 7 个 commit-ready 块)
> **执行窗口**:约 90-180 分钟(W5 是主体工程)
> **前置 commit**:`9997d6d` W4.6 ChatManager agent 接入点(已合入 master)
> **目标 commit**:7 个 commit(W5.1 / W5.2.1 / W5.2.2 / W5.2.3 / W5.2.4 / W5.2.5 / W5.3)+ 1 个 docs commit
> **当前工作目录**:`D:\pipiclaw\piclaw`
> **node_modules**:已就位(vitest + tsc 可用)

> **职责分工**:
> - **subagent**:写 24 个新 .ts/.vue + 改 1 个既有文件(`GlobalShortcut.ts` 末尾追加 D1 注册)。**不跑 git / npm install**。
> - **主会话(控制器)**:逐 commit 验收 → 跑 `git add` + `git commit` → 8 个 commit 落库 → 跑 vitest 71/71 + tsc 0 错兜底。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W5 章节(L262-L311),做 3 件事:

| Task | 模块 | 新文件 | commit |
|---|---|---|---|
| W5.1 | insight 域 | 4 .ts | 1 |
| W5.2 | agent 域 | 17 .ts | 5(工具6+主脑1+执行3+工具5+容错2)|
| W5.3 | D1 截屏问答 demo | 2(1 .ts skill + 1 .vue) + 1 修改(GlobalShortcut 末尾追加 D1 注册)| 1 |
| **合计** | | **24 新文件 + 1 改** | **7** |

---

## 2. 必读现状

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W5 章节(L262-L311) | 权威任务定义 |
| `docs/superpowers/specs/2026-07-10-pipiclaw-v2-design.md` 段 4 "关键接口签名" | 7 个域入口接口(已 W3 落到 contracts) |
| `electron/contracts/types.ts` | AgentBrain / HermesMemory / Skill 接口(注意:**AgentBrain 已定义完整 5 方法 think/call/spawn/checkpoint/restore**,W5.2 AgentBrain 必须 implements 全部 5 方法) |
| `electron/contracts/CapabilityRegistry.ts` | 单例注册表(已 W3 完成,W5.2 Agent 启动时调 `CapabilityRegistry.getInstance().register()`)|
| `electron/runtime/actor/Actor.ts` + `registry.ts` | actor 基类 + 全局注册表(已 W4 完成) |
| `electron/runtime/skill/SkillRuntime.ts` | SkillRuntime 单例(已 W4 完成,D1 demo 用它注册 skill) |
| `electron/runtime/bridge/EventBus.ts` | 事件总线(W5 agent/insight/d1 都发事件) |
| `electron/runtime/conversation/Conversation.ts` | 状态机(AgentBrain 内部用) |
| `electron/runtime/scheduler/Scheduler.ts` | 任务调度(ParallelScheduler 可复用其 PriorityQueue) |
| `electron/chat/ChatManager.ts` 906-962 行 | `registerAgent(brain)` W4.6 接入点,AgentBrain 启动时调 |
| `electron/skill/SkillManager.ts` | 1.0.0 既有 D1 demo 扩展位置 |
| `electron/learning/SelfLearner.ts` | D1 截屏问答用其固化 skill |
| `electron/core/GlobalShortcut.ts` | 1-100 行,末尾追加 D1 注册(本任务修改) |
| `electron/views/`(=`src/views/`)| D1 demo view 位置(`src/views/D1ScreenshotDemo.vue`)|

**特别注意**:
- plan §W5.3 说"用 Computer 域的 ActionExecutor 触发 Cmd+Shift+S"——**1.0.0 没有 Computer 域**(W6 才建)。正确做法:**用 `globalShortcut.register('CommandOrControl+Shift+S', ...)` + Electron 内置 `desktopCapturer`** 截全屏,通过 IPC 推到 Agent 处理。
- `desktopCapturer` 是 Electron 内置,直接 `import { desktopCapturer } from 'electron'` 即可。
- D1 的视觉理解走既有 ChatManager 通道(把图片当 user msg 追加一段 image_url / base64),W5 不新建 LLM 调用通道。
- plan §W5.1 "TraceCollector.startSpan/endSpan/getSpans/flush" —— 和 `contracts/types.ts` 段 L144-150 的 TraceCollector 接口签名(`startSpan(name, attrs?)` / `endSpan(span, result?)`)对齐。
- plan §W5.2 AgentBrain 必须 implements contracts AgentBrain 接口(5 个方法)。这意味着方法签名严格按 spec,不能自由发挥。

---

## 3. 总体原则

- **不修改既有方法**:
  - SkillManager / SkillLoader(1.0.0 既有方法 0 改动)
  - GlobalShortcut.ts(在末尾追加 D1 注册函数,既有 4 个全局快捷键 0 改动)
  - ChatManager.ts / ChatTypes.ts(W4.6 之后不再改)
  - IpcServer / preload(W3 之后不再改)
- **不引入新 npm 依赖**。纯 node 内置 + electron 内置 + 项目内模块。
- **不修改** view / component / store / router(除 D1 demo 新建 1 个 view 外)。
- **typecheck 0 错**:用 `npx tsc --noEmit` 对本次 W5 改动文件单独验证。
- **vitest 71/71 不变**(本期不写新测试,除非 inslight.md 设计建议)。

---

## 4. Task W5.1 — `insight/` 4 文件

### 4.1 文件清单

```
electron/insight/TraceCollector.ts      (200 行)
electron/insight/CostTracker.ts        (200 行)
electron/insight/TaskKanban.ts         (200 行)
electron/insight/AnomalyTimeline.ts    (200 行)
electron/insight/InsightManager.ts     (150 行,聚合入口)
```

**注:plan §W5.1 只列 4 文件,但实际需要 1 个 InsightManager 来整合入口 — 本任务加 1 个文件(共 5 文件),1 个 commit**。

### 4.2 `TraceCollector.ts`(OpenTelemetry 风格追踪)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'
import type { Span } from '../contracts/types'

export interface TraceSpanOptions {
  name: string
  attrs?: Record<string, unknown>
  parentSpanId?: string
}

export class TraceCollector {
  private static instance: TraceCollector
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private spans: Map<string, Span> = new Map()
  private maxSpans = 1000

  private constructor() {}

  public static getInstance(): TraceCollector {
    if (!TraceCollector.instance) TraceCollector.instance = new TraceCollector()
    return TraceCollector.instance
  }

  startSpan(opts: TraceSpanOptions): Span {
    const span: Span = {
      id: randomUUID(),
      name: opts.name,
      startMs: Date.now(),
      attrs: { ...(opts.attrs ?? {}), parent: opts.parentSpanId ?? null },
    }
    this.spans.set(span.id, span)
    this.log.debug(`TraceCollector: span ${span.name} start (${span.id})`)
    void this.bus.publish(`trace:span:start`, { id: span.id, name: span.name }, 'TraceCollector')
    return span
  }

  endSpan(span: Span, result?: unknown): void {
    span.endMs = Date.now()
    if (result !== undefined) span.attrs.result = result
    this.log.debug(`TraceCollector: span ${span.name} end (duration=${span.endMs - span.startMs}ms)`)
    void this.bus.publish(`trace:span:end`, { id: span.id, durationMs: span.endMs - span.startMs, attrs: span.attrs }, 'TraceCollector')
    // 自动从 active spans 移除,放入 completed 区(本期简化,只删)
    this.spans.delete(span.id)
    // 控制总数
    if (this.spans.size > this.maxSpans) {
      // 简单 FIFO 淘汰
      const firstKey = this.spans.keys().next().value
      if (firstKey) this.spans.delete(firstKey)
    }
  }

  getSpans(filter?: { name?: string; sinceMs?: number }): Span[] {
    const all = [...this.spans.values()]
    if (!filter) return all
    return all.filter(s => {
      if (filter.name && s.name !== filter.name) return false
      if (filter.sinceMs && s.startMs < filter.sinceMs) return false
      return true
    })
  }

  /** 强制 flush(本期清空,因为已经 endSpan 时就 publish 了) */
  flush(): void {
    this.spans.clear()
    this.log.info('TraceCollector: flushed')
  }

  reset(): void {
    this.spans.clear()
  }

  static resetInstance(): void {
    if (TraceCollector.instance) TraceCollector.instance.reset()
  }
}
```

### 4.3 `CostTracker.ts`(成本追踪)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'

export interface UsageEntry {
  id: string
  ts: number
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  conversationId?: string
  skillName?: string
}

export interface ModelPricing {
  inputPer1kUsd: number
  outputPer1kUsd: number
}

export class CostTracker {
  private static instance: CostTracker
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private usages: UsageEntry[] = []
  private pricing: Map<string, ModelPricing> = new Map()
  private storePath: string

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'cost-log.json')
    this.loadFromDisk()
    this.seedDefaultPricing()
  }

  public static getInstance(): CostTracker {
    if (!CostTracker.instance) CostTracker.instance = new CostTracker()
    return CostTracker.instance
  }

  private seedDefaultPricing(): void {
    // 默认 pricing(W5 后续可让用户在 Settings 页修改)
    this.pricing.set('gpt-4o', { inputPer1kUsd: 0.005, outputPer1kUsd: 0.015 })
    this.pricing.set('gpt-4o-mini', { inputPer1kUsd: 0.00015, outputPer1kUsd: 0.0006 })
    this.pricing.set('claude-sonnet-4', { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 })
    this.pricing.set('ollama-llama3', { inputPer1kUsd: 0, outputPer1kUsd: 0 })  // 本地不花钱
    this.pricing.set('zhipu-glm-4', { inputPer1kUsd: 0.001, outputPer1kUsd: 0.001 })
  }

  setPricing(model: string, p: ModelPricing): void {
    this.pricing.set(model, p)
  }

  recordUsage(entry: Omit<UsageEntry, 'id' | 'ts' | 'costUsd' | 'costUsd'> & { costUsd?: number }): UsageEntry {
    const pricing = this.pricing.get(entry.model) ?? { inputPer1kUsd: 0, outputPer1kUsd: 0 }
    const costUsd = entry.costUsd ?? ((entry.inputTokens / 1000) * pricing.inputPer1kUsd + (entry.outputTokens / 1000) * pricing.outputPer1kUsd)
    const full: UsageEntry = {
      id: randomUUID(),
      ts: Date.now(),
      costUsd,
      ...entry,
    }
    this.usages.push(full)
    void this.bus.publish('cost:usage:recorded', { model: full.model, costUsd: full.costUsd }, 'CostTracker')
    this.persistToDisk()
    return full
  }

  getTodayCost(): { totalCostUsd: number; totalInputTokens: number; totalOutputTokens: number; byModel: Record<string, number> } {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayStart = startOfDay.getTime()
    const today = this.usages.filter(u => u.ts >= todayStart)
    let totalCostUsd = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const byModel: Record<string, number> = {}
    for (const u of today) {
      totalCostUsd += u.costUsd
      totalInputTokens += u.inputTokens
      totalOutputTokens += u.outputTokens
      byModel[u.model] = (byModel[u.model] ?? 0) + u.costUsd
    }
    return { totalCostUsd, totalInputTokens, totalOutputTokens, byModel }
  }

  getRecentUsage(limit = 50): UsageEntry[] {
    return this.usages.slice(-limit)
  }

  getUsageByConversation(conversationId: string): UsageEntry[] {
    return this.usages.filter(u => u.conversationId === conversationId)
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        this.usages = JSON.parse(data)
      }
    } catch (e) {
      this.log.warn('CostTracker: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.usages))
    } catch (e) {
      this.log.warn('CostTracker: persist failed', e)
    }
  }
}
```

### 4.4 `TaskKanban.ts`(任务看板)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type KanbanColumn = 'backlog' | 'todo' | 'doing' | 'review' | 'done'
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface KanbanTask {
  id: string
  title: string
  description?: string
  column: KanbanColumn
  priority: KanbanPriority
  agentId?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
  tags?: string[]
}

export class TaskKanban {
  private static instance: TaskKanban
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private tasks: Map<string, KanbanTask> = new Map()

  private constructor() {}

  public static getInstance(): TaskKanban {
    if (!TaskKanban.instance) TaskKanban.instance = new TaskKanban()
    return TaskKanban.instance
  }

  createTask(input: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt' | 'column'> & { column?: KanbanColumn }): KanbanTask {
    const task: KanbanTask = {
      id: randomUUID(),
      column: input.column ?? 'backlog',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...input,
    }
    this.tasks.set(task.id, task)
    this.log.info(`TaskKanban: 创建任务 ${task.title} → ${task.column}`)
    void this.bus.publish('kanban:task:created', { id: task.id, title: task.title }, 'TaskKanban')
    return task
  }

  moveTask(id: string, toColumn: KanbanColumn): boolean {
    const t = this.tasks.get(id)
    if (!t) return false
    const from = t.column
    t.column = toColumn
    t.updatedAt = Date.now()
    if (toColumn === 'done') t.completedAt = Date.now()
    this.log.debug(`TaskKanban: ${t.title} ${from} → ${toColumn}`)
    void this.bus.publish('kanban:task:moved', { id, from, to: toColumn }, 'TaskKanban')
    return true
  }

  completeTask(id: string): boolean {
    return this.moveTask(id, 'done')
  }

  listTasks(opts?: { column?: KanbanColumn; priority?: KanbanPriority; agentId?: string }): KanbanTask[] {
    let tasks = [...this.tasks.values()]
    if (opts?.column) tasks = tasks.filter(t => t.column === opts.column)
    if (opts?.priority) tasks = tasks.filter(t => t.priority === opts.priority)
    if (opts?.agentId) tasks = tasks.filter(t => t.agentId === opts.agentId)
    return tasks.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getTask(id: string): KanbanTask | undefined {
    return this.tasks.get(id)
  }

  deleteTask(id: string): boolean {
    const t = this.tasks.get(id)
    if (!t) return false
    this.tasks.delete(id)
    void this.bus.publish('kanban:task:deleted', { id, title: t.title }, 'TaskKanban')
    return true
  }
}
```

### 4.5 `AnomalyTimeline.ts`(异常时间线)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type AnomalySeverity = 'info' | 'warn' | 'error' | 'critical'
export type AnomalyCategory = 'performance' | 'cost' | 'security' | 'logic' | 'integration' | 'user'

export interface Anomaly {
  id: string
  ts: number
  category: AnomalyCategory
  severity: AnomalySeverity
  title: string
  description?: string
  context?: Record<string, unknown>
  resolvedAt?: number
  resolvedBy?: string
}

export class AnomalyTimeline {
  private static instance: AnomalyTimeline
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private anomalies: Anomaly[] = []
  private maxAnomalies = 200

  private constructor() {}

  public static getInstance(): AnomalyTimeline {
    if (!AnomalyTimeline.instance) AnomalyTimeline.instance = new AnomalyTimeline()
    return AnomalyTimeline.instance
  }

  addAnomaly(anomaly: Omit<Anomaly, 'id' | 'ts'>): Anomaly {
    const a: Anomaly = { id: randomUUID(), ts: Date.now(), ...anomaly }
    this.anomalies.push(a)
    if (this.anomalies.length > this.maxAnomalies) this.anomalies.shift()
    this.log.warn(`AnomalyTimeline: [${a.severity}] ${a.category} ${a.title}`)
    void this.bus.publish('anomaly:added', { id: a.id, severity: a.severity, category: a.category }, 'AnomalyTimeline')
    return a
  }

  getRecentAnomalies(opts: { limit?: number; category?: AnomalyCategory; severity?: AnomalySeverity; sinceTs?: number } = {}): Anomaly[] {
    let filtered = [...this.anomalies]
    if (opts.category) filtered = filtered.filter(a => a.category === opts.category)
    if (opts.severity) filtered = filtered.filter(a => a.severity === opts.severity)
    if (opts.sinceTs) filtered = filtered.filter(a => a.ts >= opts.sinceTs)
    return filtered.slice(-(opts.limit ?? 50)).reverse()
  }

  resolveAnomaly(id: string, resolvedBy: string): boolean {
    const a = this.anomalies.find(x => x.id === id)
    if (!a) return false
    a.resolvedAt = Date.now()
    a.resolvedBy = resolvedBy
    void this.bus.publish('anomaly:resolved', { id, resolvedBy }, 'AnomalyTimeline')
    return true
  }

  /** 便捷方法:记录错误异常 */
  recordError(category: AnomalyCategory, error: unknown, context?: Record<string, unknown>): Anomaly {
    const message = error instanceof Error ? error.message : String(error)
    return this.addAnomaly({
      category,
      severity: 'error',
      title: message,
      context,
    })
  }
}
```

### 4.6 `InsightManager.ts`(聚合入口,plan 没列但需要)

```typescript
import { LogManager } from '../core/LogManager'
import { TraceCollector } from './TraceCollector'
import { CostTracker } from './CostTracker'
import { TaskKanban, KanbanTask } from './TaskKanban'
import { AnomalyTimeline, Anomaly } from './AnomalyTimeline'

/**
 * InsightManager: 聚合 4 个 insight 子系统,提供统一对外 API。
 * 供 Insights view (Vue) 一次性拉取全部数据。
 */
export class InsightManager {
  private static instance: InsightManager
  private log = LogManager.getInstance()
  public readonly trace: TraceCollector
  public readonly cost: CostTracker
  public readonly kanban: TaskKanban
  public readonly anomaly: AnomalyTimeline

  private constructor() {
    this.trace = TraceCollector.getInstance()
    this.cost = CostTracker.getInstance()
    this.kanban = TaskKanban.getInstance()
    this.anomaly = AnomalyTimeline.getInstance()
  }

  public static getInstance(): InsightManager {
    if (!InsightManager.instance) InsightManager.instance = new InsightManager()
    return InsightManager.instance
  }

  /** 给 Insights view 一次性拉取全部数据 */
  getDashboardPayload(): {
    today: { totalCostUsd: number; totalInputTokens: number; totalOutputTokens: number; byModel: Record<string, number> }
    tasks: KanbanTask[]
    anomalies: Anomaly[]
    activeSpans: number
  } {
    return {
      today: this.cost.getTodayCost(),
      tasks: this.kanban.listTasks(),
      anomalies: this.anomaly.getRecentAnomalies({ limit: 30 }),
      activeSpans: this.trace.getSpans().length,
    }
  }
}
```

### 4.7 更新 `index.ts`(已在 W3.1 创建,只追加 re-export)

在 `electron/insight/index.ts` 末尾追加(不改 W3.1 部分):

```typescript
// W5.1 added (保留上方 W3.1 的 AGENT_DOMAIN/INSIGHT_DOMAIN 常量不动):
export { TraceCollector } from './TraceCollector'
export type { TraceSpanOptions } from './TraceCollector'
export { CostTracker } from './CostTracker'
export type { UsageEntry, ModelPricing } from './CostTracker'
export { TaskKanban } from './TaskKanban'
export type { KanbanTask, KanbanColumn, KanbanPriority } from './TaskKanban'
export { AnomalyTimeline } from './AnomalyTimeline'
export type { Anomaly, AnomalySeverity, AnomalyCategory } from './AnomalyTimeline'
export { InsightManager } from './InsightManager'
```

### 4.8 自查清单

- [ ] 5 个新文件齐全(4 plan + 1 InsightManager)
- [ ] index.ts 只追加,不修改既有 W3.1 部分
- [ ] TraceCollector startSpan 返回 Span(id/name/startMs/attrs),endSpan 添加 endMs
- [ ] CostTracker 持久化到 userData/cost-log.json,提供 getTodayCost
- [ ] TaskKanban 5 列(backlog/todo/doing/review/done),createTask/moveTask/completeTask/listTasks
- [ ] AnomalyTimeline 6 个 category,addAnomaly/getRecent/resolveAnomaly/recordError 便捷方法
- [ ] InsightManager.getDashboardPayload 一次拉全 4 件数据
- [ ] tsc 0 错(对本次 W5.1 改动文件)

---

## 5. Task W5.2 — `agent/` 17 文件

### 5.1 总体架构

按 plan §W5.2,W5.2 拆 5 个 commit:

| 子 Task | 文件 | commit message |
|---|---|---|
| W5.2.1 工具(7 文件)| AgentConfig / AgentTypes / AgentMetrics / AgentLogger / AgentEventBus / **AgentErrorClassifier** / **AgentRetryPolicy** | `feat(agent-foundation): 6 基础工具文件 + 错误分类 + 重试` |
| W5.2.2 主脑 | AgentBrain(implements contracts AgentBrain 5 方法)| `feat(agent-brain): AgentBrain implements AgentBrain interface` |
| W5.2.3 执行(3 文件)| ExecutionEngine / ParallelScheduler / SubAgentSpawner | `feat(agent-execution): ExecutionEngine + ParallelScheduler + SubAgentSpawner` |
| W5.2.4 工具调用(5 文件)| ToolRegistry / ToolSandboxAdapter / PromptBuilder / ContextCompressor / **AgentThinking** | `feat(agent-tooling): 5 工具链(Registry + Sandbox + Prompt + Compressor + Thinking)` |
| W5.2.5 容错(2 文件)| AgentCheckpoint / AgentRecovery | `feat(agent-recovery): AgentCheckpoint + AgentRecovery` |
| **合计** | **18 文件**(plan 写 17,但实际 18:AgentErrorClassifier / RetryPolicy 在 W5.2.1,AgentThinking 在 W5.2.4,这些 plan 没明示但需要)| **5 commit** |

### 5.2 子 Task W5.2.1 — 6 基础工具(commit 1)

#### 5.2.1.1 `agent/AgentTypes.ts`(200 行,所有 agent 内部类型)

```typescript
import type { AgentBrain } from '../contracts/types'

/** Agent 内部思考链项 */
export interface ThinkingStep {
  id: string
  ts: number
  /** 思考维度: analysis / decision / critique / synthesis */
  dimension: 'analysis' | 'decision' | 'critique' | 'synthesis'
  content: string
  /** 关联的 tool call id(若有) */
  toolCallId?: string
}

/** 思考上下文(传给 LLM 的 system prompt 片段) */
export interface ThinkingContext {
  conversationId: string
  userMessage: string
  history: ThinkingStep[]
  availableTools: ToolMetadata[]
  memoryFacts: string[]
}

export interface ToolMetadata {
  name: string
  description: string
  parametersJson: Record<string, unknown>
  /** 是否需要 user 确认 */
  requiresPermission: boolean
  /** 所属域(便于调用方路由) */
  domain?: string
}

export interface AgentMetricsSnapshot {
  totalDecisions: number
  totalToolCalls: number
  successRate: number
  avgThinkDurationMs: number
  avgToolDurationMs: number
  totalCostUsd: number
}

export interface AgentDecisionRecord {
  id: string
  ts: number
  conversationId: string
  decision: { action: string; payload: unknown }
  durationMs: number
  costUsd?: number
}

export interface AgentCheckpointState {
  conversationId: string
  ts: number
  history: ThinkingStep[]
  decisions: AgentDecisionRecord[]
  tokenUsage: number
}

/** Sub-agent 派生信息 */
export interface SubAgentSpec {
  instruction: string
  parentConversationId: string
  /** 最大执行步数 */
  maxSteps?: number
  /** 派生深度(防递归) */
  depth?: number
}
```

#### 5.2.1.2 `agent/AgentConfig.ts`(150 行,单例配置)

```typescript
import { ConfigStore } from '../core/ConfigStore'
import { LogManager } from '../core/LogManager'

export interface AgentConfigData {
  maxThinkingSteps: number
  maxSubAgentDepth: number
  defaultModel: string
  enableCheckpoint: boolean
  checkpointInterval: number  // 步数
  enableMemoryInjection: boolean
  memoryTopK: number
  thinkingDimensions: Array<'analysis' | 'decision' | 'critique' | 'synthesis'>
}

const DEFAULT_CONFIG: AgentConfigData = {
  maxThinkingSteps: 20,
  maxSubAgentDepth: 3,
  defaultModel: 'gpt-4o-mini',
  enableCheckpoint: true,
  checkpointInterval: 5,
  enableMemoryInjection: true,
  memoryTopK: 5,
  thinkingDimensions: ['analysis', 'decision', 'critique', 'synthesis'],
}

const KEY = 'agent:config'

export class AgentConfig {
  private static instance: AgentConfig
  private log = LogManager.getInstance()

  private constructor() {
    const stored = ConfigStore.getInstance().get<AgentConfigData>(KEY)
    if (!stored) {
      ConfigStore.getInstance().set(KEY, DEFAULT_CONFIG)
    }
  }

  public static getInstance(): AgentConfig {
    if (!AgentConfig.instance) AgentConfig.instance = new AgentConfig()
    return AgentConfig.instance
  }

  get(): AgentConfigData {
    return ConfigStore.getInstance().get<AgentConfigData>(KEY) ?? DEFAULT_CONFIG
  }

  set(patch: Partial<AgentConfigData>): void {
    const current = this.get()
    ConfigStore.getInstance().set(KEY, { ...current, ...patch })
  }

  reset(): void {
    ConfigStore.getInstance().set(KEY, DEFAULT_CONFIG)
  }
}
```

#### 5.2.1.3 `agent/AgentMetrics.ts`(150 行,指标聚合)

```typescript
import type { AgentMetricsSnapshot, AgentDecisionRecord } from './AgentTypes'

export class AgentMetrics {
  private static instance: AgentMetrics
  private decisions: AgentDecisionRecord[] = []
  private toolCalls: { id: string; ts: number; durationMs: number; success: boolean }[] = []
  private totalCostUsd = 0

  private constructor() {}

  public static getInstance(): AgentMetrics {
    if (!AgentMetrics.instance) AgentMetrics.instance = new AgentMetrics()
    return AgentMetrics.instance
  }

  recordDecision(record: AgentDecisionRecord): void {
    this.decisions.push(record)
    if (record.costUsd !== undefined) this.totalCostUsd += record.costUsd
  }

  recordToolCall(id: string, durationMs: number, success: boolean): void {
    this.toolCalls.push({ id, ts: Date.now(), durationMs, success })
  }

  snapshot(): AgentMetricsSnapshot {
    const successfulTools = this.toolCalls.filter(t => t.success).length
    const successRate = this.toolCalls.length > 0 ? successfulTools / this.toolCalls.length : 1
    const avgThink = this.decisions.length > 0
      ? this.decisions.reduce((s, d) => s + d.durationMs, 0) / this.decisions.length
      : 0
    const avgTool = this.toolCalls.length > 0
      ? this.toolCalls.reduce((s, t) => s + t.durationMs, 0) / this.toolCalls.length
      : 0
    return {
      totalDecisions: this.decisions.length,
      totalToolCalls: this.toolCalls.length,
      successRate,
      avgThinkDurationMs: avgThink,
      avgToolDurationMs: avgTool,
      totalCostUsd: this.totalCostUsd,
    }
  }

  reset(): void {
    this.decisions = []
    this.toolCalls = []
    this.totalCostUsd = 0
  }
}
```

#### 5.2.1.4 `agent/AgentLogger.ts`(100 行,agent 专用 logger,统一输出到 EventBus + LogManager)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'

export type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AgentLogEntry {
  ts: number
  level: AgentLogLevel
  source: string
  message: string
  context?: Record<string, unknown>
}

export class AgentLogger {
  private static instance: AgentLogger
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private source: string = 'Agent'

  private constructor() {}

  public static getInstance(): AgentLogger {
    if (!AgentLogger.instance) AgentLogger.instance = new AgentLogger()
    return AgentLogger.instance
  }

  private log_(level: AgentLogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: AgentLogEntry = { ts: Date.now(), level, source: this.source, message, context }
    this.log[level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'](`[${this.source}] ${message}`, context)
    void this.bus.publish(`agent:log:${level}`, entry, this.source)
  }

  debug(message: string, context?: Record<string, unknown>): void { this.log_('debug', message, context) }
  info(message: string, context?: Record<string, unknown>): void { this.log_('info', message, context) }
  warn(message: string, context?: Record<string, unknown>): void { this.log_('warn', message, context) }
  error(message: string, context?: Record<string, unknown>): void { this.log_('error', message, context) }

  setSource(source: string): void { this.source = source }
}
```

#### 5.2.1.5 `agent/AgentEventBus.ts`(100 行,Agent 内部事件语义封装,thin layer over EventBus)

```typescript
import { EventBus } from '../runtime/bridge/EventBus'

export type AgentEvent =
  | 'agent:think:start'
  | 'agent:think:end'
  | 'agent:tool:call'
  | 'agent:tool:result'
  | 'agent:subagent:spawn'
  | 'agent:subagent:done'
  | 'agent:checkpoint:saved'
  | 'agent:recovery:started'

export type AgentEventHandler = (payload: unknown) => void | Promise<void>

export class AgentEventBus {
  private static instance: AgentEventBus
  private bus = EventBus.getInstance()

  private constructor() {}

  public static getInstance(): AgentEventBus {
    if (!AgentEventBus.instance) AgentEventBus.instance = new AgentEventBus()
    return AgentEventBus.instance
  }

  subscribe(event: AgentEvent, handler: AgentEventHandler): () => void {
    return this.bus.subscribe(event, handler)
  }

  async publish(event: AgentEvent, payload: unknown): Promise<void> {
    await this.bus.publish(event, payload, 'Agent')
  }
}
```

#### 5.2.1.6 `agent/ErrorClassifier.ts`(120 行,W5.2.1 必备,plan 没明示)

```typescript
export type ErrorKind = 'transient' | 'permanent' | 'permission' | 'rate-limit' | 'context-overflow' | 'syntax' | 'unknown'

export interface ClassifiedError {
  kind: ErrorKind
  retryable: boolean
  hint?: string
}

/**
 * 错误分类:把异常映射到 retry 策略。
 * 1. transient (网络抖动/超时) -> 重试
 * 2. rate-limit -> backoff 重试
 * 3. permanent (404/422 等不可恢复) -> 不重试
 * 4. permission -> 不重试,转 ErrorClassifier 兜底拒绝
 * 5. context-overflow -> 压缩上下文后重试
 * 6. syntax (LLM 输出格式错) -> 重新生成一次
 */
export function classifyError(e: unknown): ClassifiedError {
  const msg = e instanceof Error ? e.message : String(e)
  const lower = msg.toLowerCase()
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('unauthorized')) {
    return { kind: 'permission', retryable: false, hint: '需要权限 token 或用户授权' }
  }
  if (lower.includes('rate') || lower.includes('429') || lower.includes('quota')) {
    return { kind: 'rate-limit', retryable: true, hint: '速率限制,backoff 后重试' }
  }
  if (lower.includes('context') || lower.includes('token') && lower.includes('limit')) {
    return { kind: 'context-overflow', retryable: true, hint: '上下文超限,先压缩再重试' }
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('syntax')) {
    return { kind: 'syntax', retryable: true, hint: 'LLM 输出格式错,重新生成' }
  }
  if (lower.includes('timeout') || lower.includes('econnreset') || lower.includes('network') || lower.includes('503')) {
    return { kind: 'transient', retryable: true, hint: '临时错误,重试' }
  }
  if (lower.includes('400') || lower.includes('404') || lower.includes('422')) {
    return { kind: 'permanent', retryable: false, hint: '永久错误,不重试' }
  }
  return { kind: 'unknown', retryable: false, hint: '未知错误,需人工确认' }
}
```

#### 5.2.1.7 `agent/RetryPolicy.ts`(120 行,基于 ErrorClassifier 的重试策略)

```typescript
import { LogManager } from '../core/LogManager'
import { classifyError, ClassifiedError } from './ErrorClassifier'

export interface RetryPolicyOptions {
  maxAttempts: number        // 总尝试次数(默认 3)
  baseDelayMs: number        // 基础延迟(默认 1000)
  maxDelayMs: number         // 最大延迟(默认 10000)
  backoffMultiplier: number  // 退避倍数(默认 2)
}

const DEFAULT: RetryPolicyOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

export class RetryPolicy {
  private log = LogManager.getInstance()
  private opts: RetryPolicyOptions

  constructor(opts: Partial<RetryPolicyOptions> = {}) {
    this.opts = { ...DEFAULT, ...opts }
  }

  /** 用法: await policy.execute(fn, context?) */
  async execute<T>(fn: () => Promise<T>, label = 'retry-block'): Promise<T> {
    let attempt = 0
    let lastErr: unknown = null
    while (attempt < this.opts.maxAttempts) {
      attempt += 1
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        const cls: ClassifiedError = classifyError(e)
        if (!cls.retryable || attempt >= this.opts.maxAttempts) {
          this.log.error(`RetryPolicy: ${label} final fail (attempt ${attempt})`, e)
          throw e
        }
        const delay = Math.min(
          this.opts.baseDelayMs * Math.pow(this.opts.backoffMultiplier, attempt - 1),
          this.opts.maxDelayMs
        )
        this.log.warn(`RetryPolicy: ${label} attempt ${attempt} ${cls.kind}, backoff ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
    throw lastErr
  }
}
```

#### 5.2.1.8 自查清单

- [ ] 7 个文件齐全(AgentTypes/AgentConfig/AgentMetrics/AgentLogger/AgentEventBus/ErrorClassifier/RetryPolicy)
- [ ] AgentTypes 涵盖 ThinkingStep / ThinkingContext / ToolMetadata / AgentMetricsSnapshot / AgentDecisionRecord / AgentCheckpointState / SubAgentSpec
- [ ] AgentConfig 用 ConfigStore 持久化,提供 get/set/reset
- [ ] AgentMetrics 提供 recordDecision/recordToolCall/snapshot/reset
- [ ] AgentLogger publish 到 EventBus,4 个 level 方法
- [ ] AgentEventBus 是 EventBus 的薄封装,subscribe/publish 用 AgentEvent 类型
- [ ] ErrorClassifier 7 种 kind,带 retryable + hint
- [ ] RetryPolicy exponential backoff,maxAttempts 3,baseDelayMs 1s
- [ ] tsc 0 错

### 5.3 子 Task W5.2.2 — `AgentBrain.ts`(commit 2)

#### 5.3.1 文件

```
electron/agent/AgentBrain.ts    (~400 行)
```

#### 5.3.2 关键:必须 implements `contracts/types.ts` 的 `AgentBrain` 接口(spec 段 4 完整 5 方法):

```typescript
interface AgentBrain {
  think(ctx: AgentContext): Promise<Decision>
  call(tool: ToolCall): Promise<ToolResult>
  spawn(subtask: SubTask): Promise<SubAgent>
  checkpoint(): Promise<string>
  restore(id: string): Promise<void>
}
```

#### 5.3.3 实现骨架

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { AgentConfig } from './AgentConfig'
import { AgentLogger } from './AgentLogger'
import { AgentMetrics } from './AgentMetrics'
import { AgentEventBus } from './AgentEventBus'
import { TraceCollector } from '../insight/TraceCollector'
import { CostTracker } from '../insight/CostTracker'
import { TaskKanban } from '../insight/TaskKanban'
import { Conversation } from '../runtime/conversation/Conversation'
import type { AgentContext, Decision, ToolCall, ToolResult, SubTask, SubAgent } from '../contracts/types'
import type { ThinkingStep, ThinkingContext, ToolMetadata, AgentDecisionRecord, AgentCheckpointState } from './AgentTypes'
import { randomUUID } from 'node:crypto'

export class AgentBrainImpl {
  private static instance: AgentBrainImpl
  private log = LogManager.getInstance()
  private agentLogger = AgentLogger.getInstance()
  private bus = AgentEventBus.getInstance()
  private eventBus = EventBus.getInstance()
  private config = AgentConfig.getInstance()
  private metrics = AgentMetrics.getInstance()
  private trace = TraceCollector.getInstance()
  private cost = CostTracker.getInstance()
  private kanban = TaskKanban.getInstance()
  private conversation: Conversation | null = null
  private history: ThinkingStep[] = []
  private checkpoints: Map<string, AgentCheckpointState> = new Map()
  private subAgents: Map<string, AgentBrainImpl> = new Map()

  private constructor() {
    this.agentLogger.setSource('AgentBrain')
  }

  public static getInstance(): AgentBrainImpl {
    if (!AgentBrainImpl.instance) AgentBrainImpl.instance = new AgentBrainImpl()
    return AgentBrainImpl.instance
  }

  static resetInstance(): void {
    if (AgentBrainImpl.instance) AgentBrainImpl.instance = null as any
    AgentBrainImpl.instance = new AgentBrainImpl()
  }

  // ============ 5 个 AgentBrain 接口方法 ============

  async think(ctx: AgentContext): Promise<Decision> {
    const startMs = Date.now()
    const span = this.trace.startSpan({ name: 'agent.think', attrs: { conversationId: ctx.conversationId } })
    this.agentLogger.info('开始思考', ctx as Record<string, unknown>)

    // 1. 拿配置
    const cfg = this.config.get()
    // 2. 构建 ThinkingContext(本期简化:只取 userMessage,history,availableTools)
    const thinking: ThinkingContext = {
      conversationId: (ctx.conversationId as string) ?? 'unknown',
      userMessage: (ctx as any).content ?? '',
      history: [...this.history],
      availableTools: [], // TODO W5.2.4 ToolRegistry 提供
      memoryFacts: [], // TODO Hermes memory retrieval W6
    }
    // 3. 模拟一次决策(W5.2.3 接入 ExecutionEngine 后替换)
    const step: ThinkingStep = {
      id: randomUUID(),
      ts: Date.now(),
      dimension: 'decision',
      content: `[stub] think 收到 ${thinking.userMessage.slice(0, 30)}`,
    }
    this.history.push(step)
    const decision: Decision = { action: 'reply', payload: { text: `思考完成: ${thinking.userMessage.slice(0, 50)}` } }

    // 4. 指标 + trace end
    const durationMs = Date.now() - startMs
    const record: AgentDecisionRecord = {
      id: randomUUID(),
      ts: Date.now(),
      conversationId: thinking.conversationId,
      decision: { action: decision.action, payload: decision.payload },
      durationMs,
    }
    this.metrics.recordDecision(record)
    this.cost.recordUsage({ model: cfg.defaultModel, inputTokens: 0, outputTokens: 0, conversationId: thinking.conversationId })
    await this.bus.publish('agent:think:end', { decision, durationMs })
    this.trace.endSpan(span, decision)
    return decision
  }

  async call(tool: ToolCall): Promise<ToolResult> {
    const span = this.trace.startSpan({ name: 'agent.call', attrs: { toolName: tool.name } })
    const startMs = Date.now()
    this.agentLogger.info('调用工具', tool as any)
    // TODO W5.2.4 ToolRegistry 接入
    const result: ToolResult = { ok: true, data: { stub: true, tool: tool.name, args: tool.args } }
    const durationMs = Date.now() - startMs
    this.metrics.recordToolCall(randomUUID(), durationMs, true)
    this.trace.endSpan(span, result)
    return result
  }

  async spawn(subtask: SubTask): Promise<SubAgent> {
    const child = new AgentBrainImpl()
    const id = randomUUID()
    this.subAgents.set(id, child)
    this.log.info(`AgentBrain: spawn sub-agent ${id} for "${subtask.instruction.slice(0, 30)}"`)
    await this.bus.publish('agent:subagent:spawn', { id, instruction: subtask.instruction })
    return { id, brain: child as unknown as AgentBrainImpl }
  }

  async checkpoint(): Promise<string> {
    if (!this.config.get().enableCheckpoint) return ''
    const state: AgentCheckpointState = {
      conversationId: this.conversation?.id ?? 'unknown',
      ts: Date.now(),
      history: [...this.history],
      decisions: [], // 简化为只记 history
      tokenUsage: 0,
    }
    const id = randomUUID()
    this.checkpoints.set(id, state)
    this.log.info(`AgentBrain: checkpoint saved ${id}`)
    await this.bus.publish('agent:checkpoint:saved', { id })
    return id
  }

  async restore(id: string): Promise<void> {
    const state = this.checkpoints.get(id)
    if (!state) {
      this.log.warn(`AgentBrain: checkpoint ${id} not found`)
      return
    }
    this.history = [...state.history]
    this.log.info(`AgentBrain: restored from ${id}, ${state.history.length} steps`)
    await this.bus.publish('agent:recovery:started', { id })
  }

  // ============ 内部管理方法(非接口) ============

  getHistory(): ThinkingStep[] {
    return [...this.history]
  }

  setConversation(c: Conversation): void {
    this.conversation = c
  }

  getConversation(): Conversation | null {
    return this.conversation
  }

  getSubAgent(id: string): AgentBrainImpl | undefined {
    return this.subAgents.get(id)
  }

  listCheckpoints(): string[] {
    return [...this.checkpoints.keys()]
  }
}
```

**重要设计**:AgentBrainImpl **不是 implements contracts AgentBrain**,而是**结构 duck-typed**(方法签名与 AgentBrain 完全一致,可通过 `as AgentBrain` 断言)。这样 ChatManager.registerAgent 可接收它而不需要 cast。在类末尾 export 一个函数 `asAgentBrain()`:

```typescript
/** 转换为 contracts AgentBrain 接口(用于 ChatManager.registerAgent / CapabilityRegistry.register) */
export function asAgentBrain(brain: AgentBrainImpl): import('../contracts/types').AgentBrain {
  return brain as unknown as import('../contracts/types').AgentBrain
}
```

#### 5.3.4 自查清单

- [ ] 1 文件齐全
- [ ] 5 个方法(think/call/spawn/checkpoint/restore)签名与 contracts AgentBrain 完全一致
- [ ] think() 内调 metrics.recordDecision + cost.recordUsage + trace.endSpan
- [ ] call() stub 返回 `{ ok: true, data: { stub: true, ... } }`
- [ ] spawn() 创建子 AgentBrainImpl,返回 { id, brain }
- [ ] checkpoint() 用 enableCheckpoint 配置守卫
- [ ] restore() 找不到时打 warn 而不 throw
- [ ] 提供 asAgentBrain() 桥接 helper
- [ ] tsc 0 错

### 5.4 子 Task W5.2.3 — 执行 3 件套(commit 3)

#### 5.4.1 文件

```
electron/agent/ExecutionEngine.ts       (~250 行)
electron/agent/ParallelScheduler.ts     (~200 行)
electron/agent/SubAgentSpawner.ts       (~150 行)
```

#### 5.4.2 `ExecutionEngine.ts`(执行决策,将 think 结果转成动作)

```typescript
import { LogManager } from '../core/LogManager'
import { AgentConfig } from './AgentConfig'
import type { Decision, ToolCall } from '../contracts/types'

export interface ExecutionResult {
  ok: boolean
  action: string
  output: unknown
  durationMs: number
  error?: string
}

/**
 * ExecutionEngine: 把 AgentBrain.think() 出来的 Decision 转成具体动作执行。
 * 本期(W5.2.3)只 stub,真实 call 工具逻辑由 ToolRegistry (W5.2.4) 接管。
 */
export class ExecutionEngine {
  private static instance: ExecutionEngine
  private log = LogManager.getInstance()
  private config = AgentConfig.getInstance()

  private constructor() {}

  public static getInstance(): ExecutionEngine {
    if (!ExecutionEngine.instance) ExecutionEngine.instance = new ExecutionEngine()
    return ExecutionEngine.instance
  }

  /**
   * 执行一个 Decision
   * action == 'think' -> 不需要执行,返回原 Decision
   * action == 'call'  -> 执行 tool call(W5.2.4 接入 ToolRegistry)
   * action == 'spawn' -> 派生 sub-agent
   * action == 'reply' -> 把 payload 推给 ChatManager 流
   * action == 'stop'  -> 终止
   */
  async execute(decision: Decision, toolCall?: ToolCall): Promise<ExecutionResult> {
    const startMs = Date.now()
    this.log.debug(`ExecutionEngine: ${decision.action}`)

    if (decision.action === 'think') {
      return { ok: true, action: 'think', output: decision.payload, durationMs: Date.now() - startMs }
    }
    if (decision.action === 'stop') {
      return { ok: true, action: 'stop', output: null, durationMs: Date.now() - startMs }
    }
    if (decision.action === 'reply') {
      // 把 reply payload 推给 ChatManager 流(wired in main.ts boot 阶段)
      return { ok: true, action: 'reply', output: decision.payload, durationMs: Date.now() - startMs }
    }
    if (decision.action === 'call') {
      // TODO W5.2.4 接入 ToolRegistry
      return {
        ok: true,
        action: 'call',
        output: { stub: true, note: 'ToolRegistry W5.2.4 接管' },
        durationMs: Date.now() - startMs,
      }
    }
    if (decision.action === 'spawn') {
      // TODO W5.2.3 SubAgentSpawner 接入
      return {
        ok: true,
        action: 'spawn',
        output: { stub: true, note: 'SubAgentSpawner W5.2.3 接管' },
        durationMs: Date.now() - startMs,
      }
    }
    return { ok: false, action: decision.action, output: null, durationMs: Date.now() - startMs, error: `unknown action: ${decision.action}` }
  }
}
```

#### 5.4.3 `ParallelScheduler.ts`(并行调度多 sub-task)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { PriorityQueue } from '../runtime/scheduler/PriorityQueue'
import type { SubTask, SubAgent } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export interface ParallelSubTask extends SubTask {
  id: string
  priority: number
  result?: unknown
  error?: string
  durationMs?: number
  status: 'pending' | 'running' | 'success' | 'failed'
}

export class ParallelScheduler {
  private static instance: ParallelScheduler
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private queue: PriorityQueue<ParallelSubTask>
  private maxConcurrent: number

  private constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent
    this.queue = new PriorityQueue<ParallelSubTask>()
  }

  public static getInstance(): ParallelScheduler {
    if (!ParallelScheduler.instance) ParallelScheduler.instance = new ParallelScheduler()
    return ParallelScheduler.instance
  }

  enqueue(subtask: Omit<ParallelSubTask, 'id' | 'status'>): string {
    const task: ParallelSubTask = { id: randomUUID(), status: 'pending', ...subtask }
    this.queue.enqueue(task, task.priority)
    this.log.debug(`ParallelScheduler: enqueue ${task.id} (priority=${task.priority})`)
    return task.id
  }

  async runAll(handler: (task: ParallelSubTask) => Promise<unknown>): Promise<ParallelSubTask[]> {
    const results: ParallelSubTask[] = []
    const inFlight = new Map<string, Promise<void>>()
    while (this.queue.size() > 0 || inFlight.size > 0) {
      while (inFlight.size < this.maxConcurrent && this.queue.size() > 0) {
        const task = this.queue.dequeue()
        if (!task) break
        task.status = 'running'
        const taskStartMs = Date.now()
        const p = handler(task).then(
          (r) => {
            task.status = 'success'
            task.result = r
            task.durationMs = Date.now() - taskStartMs
            results.push(task)
          },
          (e) => {
            task.status = 'failed'
            task.error = String(e)
            task.durationMs = Date.now() - taskStartMs
            results.push(task)
          }
        )
        inFlight.set(task.id, p)
      }
      // 等任意一个完成
      if (inFlight.size > 0) {
        await Promise.race(inFlight.values())
        // 清理已完成的
        for (const [id, p] of inFlight) {
          if ((await Promise.race([p, Promise.resolve('pending')])) !== 'pending') {
            inFlight.delete(id)
          }
        }
      }
    }
    return results
  }

  stats() {
    return { queued: this.queue.size(), maxConcurrent: this.maxConcurrent }
  }
}
```

#### 5.4.4 `SubAgentSpawner.ts`(派生 sub-agent)

```typescript
import { LogManager } from '../core/LogManager'
import { AgentBrainImpl, asAgentBrain } from './AgentBrain'
import { EventBus } from '../runtime/bridge/EventBus'
import type { SubTask, SubAgent } from '../contracts/types'

export interface SubAgentHandle {
  id: string
  instruction: string
  brain: AgentBrainImpl
  parentConversationId: string
  depth: number
  startedAt: number
}

export class SubAgentSpawner {
  private static instance: SubAgentSpawner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private handles: Map<string, SubAgentHandle> = new Map()
  private maxDepth: number

  private constructor(maxDepth = 3) {
    this.maxDepth = maxDepth
  }

  public static getInstance(): SubAgentSpawner {
    if (!SubAgentSpawner.instance) SubAgentSpawner.instance = new SubAgentSpawner()
    return SubAgentSpawner.instance
  }

  async spawn(subtask: SubTask, parentConversationId: string, depth = 0): Promise<SubAgent> {
    if (depth > this.maxDepth) {
      throw new Error(`SubAgentSpawner: 派生深度超过 ${this.maxDepth},终止`)
    }
    const brain = new AgentBrainImpl()
    const id = `sub-${subtask.instruction.slice(0, 12)}-${Date.now()}`
    const handle: SubAgentHandle = {
      id,
      instruction: subtask.instruction,
      brain,
      parentConversationId,
      depth,
      startedAt: Date.now(),
    }
    this.handles.set(id, handle)
    this.log.info(`SubAgentSpawner: ${id} 派生成功 (depth=${depth}, parent=${parentConversationId})`)
    await this.bus.publish('agent:subagent:spawn', { id, instruction: subtask.instruction, depth }, 'SubAgentSpawner')
    return { id, brain: asAgentBrain(brain) }
  }

  async runSubTask(id: string): Promise<unknown> {
    const h = this.handles.get(id)
    if (!h) throw new Error(`SubAgentSpawner: ${id} not found`)
    return await h.brain.think({ conversationId: h.parentConversationId, content: h.instruction })
  }

  getHandle(id: string): SubAgentHandle | undefined {
    return this.handles.get(id)
  }

  list(): SubAgentHandle[] {
    return [...this.handles.values()]
  }
}
```

#### 5.4.5 自查清单

- [ ] 3 文件齐全
- [ ] ExecutionEngine 处理 5 种 action(think/call/spawn/reply/stop)
- [ ] ParallelScheduler 用 PriorityQueue + maxConcurrent
- [ ] SubAgentSpawner 派生深度守卫(maxDepth=3)
- [ ] tsc 0 错

### 5.5 子 Task W5.2.4 — 工具链 5 件套(commit 4)

#### 5.5.1 文件

```
electron/agent/ToolRegistry.ts          (~250 行)
electron/agent/ToolSandboxAdapter.ts    (~200 行)
electron/agent/PromptBuilder.ts         (~250 行)
electron/agent/ContextCompressor.ts     (~200 行)
electron/agent/AgentThinking.ts         (~150 行)
```

#### 5.5.2 `ToolRegistry.ts`(tool 注册表)

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ToolCall, ToolResult } from '../contracts/types'
import type { ToolMetadata } from './AgentTypes'
import { PermissionManager } from '../permissions/PermissionManager'
import { randomUUID } from 'node:crypto'

export interface ToolDefinition {
  metadata: ToolMetadata
  /** handler: 接收 LLM 输出的 JSON 参数,返回 ToolResult */
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

export class ToolRegistry {
  private static instance: ToolRegistry
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private permissionManager = PermissionManager.getInstance()
  private tools: Map<string, ToolDefinition> = new Map()

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) ToolRegistry.instance = new ToolRegistry()
    return ToolRegistry.instance
  }

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.metadata.name)) {
      this.log.warn(`ToolRegistry: ${tool.metadata.name} 已注册,覆盖`)
    }
    this.tools.set(tool.metadata.name, tool)
    this.log.info(`ToolRegistry: 注册 tool ${tool.metadata.name}`)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  list(): ToolMetadata[] {
    return [...this.tools.values()].map(t => t.metadata)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  async invoke(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return { ok: false, error: `Tool ${call.name} 未注册` }
    }
    // 权限校验
    if (tool.metadata.requiresPermission) {
      const allowed = await this.permissionManager.check('tool:invoke', { name: call.name, args: call.args })
      if (!allowed) {
        await this.bus.publish('tool:denied', { name: call.name })
        return { ok: false, error: `Tool ${call.name} 未获权限` }
      }
    }
    const startMs = Date.now()
    try {
      const data = await tool.handler(call.args)
      void this.bus.publish('tool:result', { id: randomUUID(), name: call.name, ok: true, durationMs: Date.now() - startMs })
      return { ok: true, data }
    } catch (e) {
      void this.bus.publish('tool:result', { id: randomUUID(), name: call.name, ok: false, durationMs: Date.now() - startMs, error: String(e) })
      return { ok: false, error: String(e) }
    }
  }
}
```

#### 5.5.3 `ToolSandboxAdapter.ts`(在 sandbox 域内运行 tool,W5 阶段 stub)

```typescript
import { LogManager } from '../core/LogManager'
import type { ToolCall, ToolResult } from '../contracts/types'

export type SandboxMode = 'none' | 'process' | 'docker' | 'webcontainer'

export interface SandboxedToolOptions {
  mode: SandboxMode
  timeoutMs?: number
  memoryMb?: number
  /** 允许读写的路径 */
  allowPaths?: string[]
}

/**
 * ToolSandboxAdapter: 把工具调用包到 sandbox 里跑。
 * W5 阶段仅实现 mode='none'(不隔离)+ mode='process'(子进程)stub;
 * W9+ 接入 P7 sandbox 后支持 docker / webcontainer。
 */
export class ToolSandboxAdapter {
  private static instance: ToolSandboxAdapter
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): ToolSandboxAdapter {
    if (!ToolSandboxAdapter.instance) ToolSandboxAdapter.instance = new ToolSandboxAdapter()
    return ToolSandboxAdapter.instance
  }

  async runInSandbox(call: ToolCall, opts: SandboxedToolOptions = { mode: 'none' }): Promise<ToolResult> {
    if (opts.mode === 'none') {
      // 不隔离:直接返回 stub(W5 把工具调用全放主进程)
      this.log.debug(`ToolSandboxAdapter[none]: ${call.name}`)
      return { ok: true, data: { stub: true, mode: 'none', tool: call.name, args: call.args } }
    }
    // process / docker / webcontainer: W9+ 接入 P7 sandbox
    this.log.warn(`ToolSandboxAdapter: mode ${opts.mode} 未实装(W9+),降级为 stub`)
    return { ok: true, data: { stub: true, mode: opts.mode, deferred: true } }
  }
}
```

#### 5.5.4 `PromptBuilder.ts`(拼装 prompt)

```typescript
import { LogManager } from '../core/LogManager'
import { AgentConfig } from './AgentConfig'
import type { ThinkingContext } from './AgentTypes'

export class PromptBuilder {
  private static instance: PromptBuilder
  private log = LogManager.getInstance()
  private config = AgentConfig.getInstance()

  private constructor() {}

  public static getInstance(): PromptBuilder {
    if (!PromptBuilder.instance) PromptBuilder.instance = new PromptBuilder()
    return PromptBuilder.instance
  }

  /** 系统 prompt(W5 固定字符串,后续 W6 让用户从 Settings 改) */
  buildSystemPrompt(): string {
    return `你是 PiPiClaw Agent,一个本地化桌面 AI 助手。
规则:
1. 优先用本地工具完成用户请求;能不联网就不联网。
2. 思考分 4 步: analysis (分析) / decision (决策) / critique (自检) / synthesis (综合)。
3. 工具调用必须符合 ToolRegistry 暴露的 schema,没注册的工具禁止调用。
4. 中文输出。
5. 子任务派生不超过 ${this.config.get().maxSubAgentDepth} 层(防递归)。
6. 思考不要超过 ${this.config.get().maxThinkingSteps} 步。`
  }

  buildUserPrompt(ctx: ThinkingContext): string {
    let prompt = `# 用户最新消息\n\n${ctx.userMessage}\n\n`
    if (ctx.history.length > 0) {
      prompt += `# 思考历史(最近 ${ctx.history.length} 步)\n\n`
      for (const step of ctx.history.slice(-5)) {
        prompt += `- [${step.dimension}] ${step.content.slice(0, 100)}\n`
      }
      prompt += '\n'
    }
    if (ctx.memoryFacts.length > 0) {
      prompt += `# 关联记忆(${ctx.memoryFacts.length} 条)\n\n`
      for (const m of ctx.memoryFacts.slice(0, 5)) {
        prompt += `- ${m}\n`
      }
      prompt += '\n'
    }
    if (ctx.availableTools.length > 0) {
      prompt += `# 可用工具\n\n`
      for (const t of ctx.availableTools) {
        prompt += `- ${t.name}: ${t.description}\n`
      }
    }
    return prompt
  }
}
```

#### 5.5.5 `ContextCompressor.ts`(上下文压缩)

```typescript
import { LogManager } from '../core/LogManager'
import type { ThinkingStep } from './AgentTypes'

export interface CompressionOptions {
  /** 触发压缩的 token 估算上限 */
  maxTokens: number
  /** 压缩目标(默认保留 50%) */
  targetRatio: number
}

const DEFAULT: CompressionOptions = { maxTokens: 8000, targetRatio: 0.5 }

/**
 * 简易上下文压缩(W5 不接 LLM 摘要,只做滑动窗口 + 摘要占位):
 * 1. 保留 system prompt + 最近 maxTokens / 2 的消息原文
 * 2. 中间的用 [compressed] 占位
 * 3. 超出 maxTokens 的直接裁掉
 */
export class ContextCompressor {
  private static instance: ContextCompressor
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): ContextCompressor {
    if (!ContextCompressor.instance) ContextCompressor.instance = new ContextCompressor()
    return ContextCompressor.instance
  }

  /** 估算 token(粗略 4 字符/token) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /** 压缩 history 列表 */
  compressHistory(history: ThinkingStep[], opts: Partial<CompressionOptions> = {}): ThinkingStep[] {
    const cfg = { ...DEFAULT, ...opts }
    // 把 history 的 content 拼成一行
    const totalText = history.map(h => h.content).join('\n')
    const tokens = this.estimateTokens(totalText)
    if (tokens <= cfg.maxTokens) return history
    const target = Math.floor(history.length * cfg.targetRatio)
    if (target >= history.length) return history
    const keepHead = Math.floor(target / 2)
    const keepTail = target - keepHead
    const head = history.slice(0, keepHead)
    const tail = history.slice(history.length - keepTail)
    const placeholder: ThinkingStep = {
      id: 'compressed',
      ts: Date.now(),
      dimension: 'synthesis',
      content: `[compressed] ${history.length - head.length - tail.length} 步被压缩,原长 ${tokens} tokens`,
    }
    return [...head, placeholder, ...tail]
  }
}
```

#### 5.5.6 `AgentThinking.ts`(具体调用 LLM,W5 stub)

```typescript
import { LogManager } from '../core/LogManager'
import { AgentConfig } from './AgentConfig'
import type { ThinkingContext } from './AgentTypes'
import type { Decision } from '../contracts/types'
import { randomUUID } from 'node:crypto'

/**
 * AgentThinking: 真正调 LLM 拿回 Decision。
 * W5 阶段只 stub(返回确定性 decision),真实 LLM 调用 W5+W6 接入 ChatManager 通道。
 */
export class AgentThinking {
  private static instance: AgentThinking
  private log = LogManager.getInstance()
  private config = AgentConfig.getInstance()

  private constructor() {}

  public static getInstance(): AgentThinking {
    if (!AgentThinking.instance) AgentThinking.instance = new AgentThinking()
    return AgentThinking.instance
  }

  async think(ctx: ThinkingContext): Promise<Decision> {
    const cfg = this.config.get()
    this.log.debug(`AgentThinking[${cfg.defaultModel}]: ${ctx.userMessage.slice(0, 50)}`)
    // stub:返回一个 reply 决策
    return {
      action: 'reply',
      payload: {
        text: `[stub-think] ${cfg.defaultModel} 收到: ${ctx.userMessage.slice(0, 80)}`,
        thinkingId: randomUUID(),
      },
    }
  }
}
```

#### 5.5.7 自查清单

- [ ] 5 文件齐全(ToolRegistry / ToolSandboxAdapter / PromptBuilder / ContextCompressor / AgentThinking)
- [ ] ToolRegistry.invoke 走 PermissionManager.check(requiresPermission 时)
- [ ] ToolSandboxAdapter 仅 mode='none' 实装,其余降级 stub
- [ ] PromptBuilder.buildSystemPrompt 包含 4 步思考 / 中文输出 / 子任务限制
- [ ] ContextCompressor 滑动窗口 + [compressed] 占位
- [ ] AgentThinking stub 返回确定性 Decision(action='reply')
- [ ] tsc 0 错

### 5.6 子 Task W5.2.5 — 容错 2 件套(commit 5)

#### 5.6.1 文件

```
electron/agent/AgentCheckpoint.ts   (~250 行)
electron/agent/AgentRecovery.ts     (~250 行)
```

#### 5.6.2 `AgentCheckpoint.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import type { AgentCheckpointState } from './AgentTypes'

/**
 * AgentCheckpoint: 把 AgentBrain.checkpoint() 的状态序列化到磁盘,~/.pipiclaw/checkpoints/{id}.json
 * restore() 时从磁盘读回完整 state。
 * W5 阶段:W6 才接 Hermes 记忆重建,本期只做"落盘+读回"。
 */
export class AgentCheckpointStore {
  private static instance: AgentCheckpointStore
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storeDir: string

  private constructor() {
    this.storeDir = path.join(app.getPath('userData'), 'checkpoints')
    if (!fs.existsSync(this.storeDir)) fs.mkdirSync(this.storeDir, { recursive: true })
  }

  public static getInstance(): AgentCheckpointStore {
    if (!AgentCheckpointStore.instance) AgentCheckpointStore.instance = new AgentCheckpointStore()
    return AgentCheckpointStore.instance
  }

  async save(state: AgentCheckpointState): Promise<string> {
    const id = `${state.conversationId}-${Date.now()}-${randomUUID().slice(0, 6)}`
    const filePath = path.join(this.storeDir, `${id}.json`)
    try {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2))
      this.log.info(`AgentCheckpoint: saved ${id}`)
      await this.bus.publish('checkpoint:saved', { id, conversationId: state.conversationId })
      return id
    } catch (e) {
      this.log.error(`AgentCheckpoint: save ${id} failed`, e)
      throw e
    }
  }

  async load(id: string): Promise<AgentCheckpointState | null> {
    const filePath = path.join(this.storeDir, `${id}.json`)
    try {
      if (!fs.existsSync(filePath)) return null
      const data = fs.readFileSync(filePath, 'utf-8')
      const state = JSON.parse(data) as AgentCheckpointState
      this.log.info(`AgentCheckpoint: loaded ${id}, ${state.history.length} history steps`)
      return state
    } catch (e) {
      this.log.warn(`AgentCheckpoint: load ${id} failed`, e)
      return null
    }
  }

  list(): string[] {
    try {
      return fs.readdirSync(this.storeDir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
    } catch {
      return []
    }
  }

  delete(id: string): boolean {
    const filePath = path.join(this.storeDir, `${id}.json`)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}
```

#### 5.6.3 `AgentRecovery.ts`

```typescript
import { LogManager } from '../core/LogManager'
import { AgentCheckpointStore } from './AgentCheckpoint'
import { AgentBrainImpl, asAgentBrain } from './AgentBrain'
import { AgentMetrics } from './AgentMetrics'
import { AnomalyTimeline } from '../insight/AnomalyTimeline'
import { EventBus } from '../runtime/bridge/EventBus'
import type { AgentBrain } from '../contracts/types'
import { classifyError } from './ErrorClassifier'
import { RetryPolicy } from './RetryPolicy'

/**
 * AgentRecovery: 当 AgentBrain 异常时,自动从最近 checkpoint 恢复 + 用 RetryPolicy 重试。
 * W5 阶段:仅支持"恢复 + 重试"。W6 接 Hermes 长期记忆补全历史上下文。
 */
export class AgentRecovery {
  private static instance: AgentRecovery
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private store = AgentCheckpointStore.getInstance()
  private metrics = AgentMetrics.getInstance()
  private anomaly = AnomalyTimeline.getInstance()
  private defaultRetry: RetryPolicy

  private constructor() {
    this.defaultRetry = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 2000, backoffMultiplier: 2 })
  }

  public static getInstance(): AgentRecovery {
    if (!AgentRecovery.instance) AgentRecovery.instance = new AgentRecovery()
    return AgentRecovery.instance
  }

  /** 从指定 id 恢复 */
  async recoverFromCheckpoint(brain: AgentBrainImpl, checkpointId: string): Promise<boolean> {
    const state = await this.store.load(checkpointId)
    if (!state) {
      this.log.warn(`AgentRecovery: checkpoint ${checkpointId} 不存在或损坏`)
      return false
    }
    brain.setHistory(state.history)
    this.log.info(`AgentRecovery: 已恢复 ${state.history.length} 步历史`)
    await this.bus.publish('agent:recovery:completed', { checkpointId, conversationId: state.conversationId })
    return true
  }

  /** 用 RetryPolicy 包装 think(),失败则先尝试 checkpoint 恢复,再重试 */
  async resilientThink(brain: AgentBrain, ctx: any): Promise<unknown> {
    try {
      return await this.defaultRetry.execute(() => brain.think(ctx as any))
    } catch (e) {
      const cls = classifyError(e)
      this.anomaly.recordError('logic', e, { phase: 'resilientThink', kind: cls.kind })
      if (!cls.retryable) throw e
      // 重试类错误:尝试从最近 checkpoint 恢复 1 次
      const impl = brain as unknown as AgentBrainImpl
      const checkpoints = impl.listCheckpoints()
      if (checkpoints.length > 0) {
        const lastId = checkpoints[checkpoints.length - 1]
        this.log.info(`AgentRecovery: 尝试从 ${lastId} 恢复并重试`)
        const recovered = await this.recoverFromCheckpoint(impl, lastId)
        if (recovered) {
          return await this.defaultRetry.execute(() => brain.think(ctx as any))
        }
      }
      throw e
    }
  }
}
```

#### 5.6.4 自查清单

- [ ] 2 文件齐全(AgentCheckpoint + AgentRecovery)
- [ ] AgentCheckpoint 用 app.getPath('userData') + checkpoints/{id}.json 落盘
- [ ] AgentRecovery.recoverFromCheckpoint + resilientThink 包装 think() + 用 RetryPolicy
- [ ] tsc 0 错

---

## 6. Task W5.3 — D1 截屏问答 demo

### 6.1 文件清单

```
electron/skill/builtin/D1ScreenshotQA.ts     (~250 行)
src/views/D1ScreenshotDemo.vue               (~350 行)
electron/core/GlobalShortcut.ts              (+30 行,末尾追加 D1 注册)
```

**注:plan §W5.3 说"用 Computer 域的 ActionExecutor 触发 Cmd+Shift+S",但 1.0.0 没有 Computer 域(W6 才建)。本任务用 Electron 内置 `globalShortcut` + `desktopCapturer` 实现**。

### 6.2 `electron/skill/builtin/D1ScreenshotQA.ts`

```typescript
import { LogManager } from '../../core/LogManager'
import { BrowserWindow } from 'electron'
import { SkillRuntime } from '../../runtime/skill/SkillRuntime'

/**
 * D1ScreenshotQA: 截屏问答 skill
 * 调用流程:
 * 1. 用户按 Cmd+Shift+S(由 GlobalShortcut.ts register 转发到此 handler)
 * 2. 通过 desktopCapturer 拿到全屏图片(Buffer)
 * 3. 在 ChatManager 流上追加一条 user message(包含图片 + "用户问了一个问题")
 * 4. AgentBrain 想/生成回答(本期 stub:固定回复"看到截图,详细请描述")
 * 5. SelfLearner 在 Skill 库中固化本次问答为可复用 Skill
 * 
 * W5 阶段 D1 demo:仅做桌面截屏触发 + 推送 user msg 到 ChatManager + stub 回答。
 * W6+W7 接 LLM 视觉理解 + SelfLearner 自动生成 Skill。
 */
export async function handleD1Shortcut(): Promise<void> {
  const log = LogManager.getInstance()
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) {
    log.warn('D1ScreenshotQA: 无可用 BrowserWindow')
    return
  }
  try {
    const { desktopCapturer } = await import('electron')
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } })
    if (sources.length === 0) {
      log.warn('D1ScreenshotQA: 无屏幕源')
      return
    }
    const source = sources[0]
    const thumbnail = source.thumbnail  // NativeImage
    const dataUrl = thumbnail.toDataURL()
    const buffer = thumbnail.toPNG()

    // 推送到渲染端(给 ChatManager 流)
    win.webContents.send('d1:screenshot:captured', {
      ts: Date.now(),
      dataUrl: dataUrl.slice(0, 200) + '...[truncated]',  // 仅预发送前 200 字符,完整 buffer 走 IPC
      sizeBytes: buffer.length,
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
      note: 'W5 阶段 D1 stub:图片已截,Agent 真实理解待 LLM 接入',
    })

    log.info(`D1ScreenshotQA: 截图 ${thumbnail.getSize().width}x${thumbnail.getSize().height}, ${buffer.length} bytes`)
  } catch (e) {
    log.error('D1ScreenshotQA: 截屏失败', e)
  }
}

/** D1 demo skill handler(SkillRuntime 用,供 ChatManager 调) */
export const D1_SKILL_NAME = 'd1:screenshot-qa'

export const d1SkillHandler = {
  name: D1_SKILL_NAME,
  description: '用户截屏后,Agent 对截图内容提问并回答',
  requiresPermission: false,
  async execute(args: { question?: string; imageDataUrl?: string }): Promise<{ ok: boolean; answer: string; stub?: boolean }> {
    log.info(`D1 skill 触发 question="${args.question}", 有图=${!!args.imageDataUrl}`)
    return {
      ok: true,
      stub: true,
      answer: `[D1 W5 stub] 看到截图(若有),用户问题:"${args.question ?? '(未提供)'}"。W6 接 LLM 视觉理解后,这里会输出真实回答。`,
    }
  },
}
```

### 6.3 `electron/core/GlobalShortcut.ts` 末尾追加 D1 注册

**在文件最末尾(`export class` 之后 或 export 语句附近)追加:**

```typescript
// ============ W5.3 新增:D1 截屏问答快捷键 (additive,不改既有快捷键) ============
import { handleD1Shortcut } from '../skill/builtin/D1ScreenshotQA'

export function registerD1ScreenshotShortcut(): boolean {
  try {
    const { globalShortcut } = require('electron')
    const accelerator = 'CommandOrControl+Shift+S'
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator)
    }
    const ok = globalShortcut.register(accelerator, () => {
      void handleD1Shortcut()
    })
    this.log?.info(`GlobalShortcut[D1]: ${accelerator} ${ok ? 'OK' : 'FAIL'}`)
    return ok
  } catch (e) {
    this.log?.error('GlobalShortcut[D1]: 注册失败', e)
    return false
  }
}
```

**注意**:`GlobalShortcut.ts` 顶部如有 import 块,需要在新 import 块顶部追加 import handleD1Shortcut(上面代码块已用 require 模式避开 require/import 选择)。

**自查**:现有 export 函数 0 改动,只追加新 export 函数 + 顶部 import(若有)。

### 6.4 `src/views/D1ScreenshotDemo.vue`

```vue
<template>
  <div class="d1-demo">
    <h2>D1 截屏问答 Demo</h2>
    <p class="d1-hint">按 <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> 触发截屏问答。</p>

    <div class="d1-actions">
      <el-button type="primary" @click="triggerScreenshot" :loading="isCapturing">
        手动触发截屏
      </el-button>
      <el-button @click="clearLog">清空记录</el-button>
    </div>

    <div class="d1-captured" v-if="capturedImage">
      <div class="d1-card">
        <h3>最近一次截图</h3>
        <img :src="capturedImage" alt="captured" class="d1-img" />
        <p class="d1-meta">
          大小: {{ capturedSize }} | 时间: {{ capturedAt }}
        </p>
      </div>
    </div>

    <div class="d1-qa">
      <h3>问答日志</h3>
      <ul class="d1-log">
        <li v-for="(entry, i) in qaLog" :key="i" :class="`d1-log-item d1-${entry.kind}`">
          <span class="d1-log-time">{{ entry.time }}</span>
          <span class="d1-log-content">{{ entry.content }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const capturedImage = ref<string | null>(null)
const capturedSize = ref<string>('')
const capturedAt = ref<string>('')
const isCapturing = ref(false)
const qaLog = ref<Array<{ time: string; content: string; kind: 'info' | 'answer' | 'error' }>>([])

function appendLog(content: string, kind: 'info' | 'answer' | 'error' = 'info') {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  qaLog.value.push({ time: now, content, kind })
  if (qaLog.value.length > 50) qaLog.value.shift()
}

async function triggerScreenshot() {
  if (!window.electronAPI) {
    appendLog('当前非 Electron 环境', 'error')
    return
  }
  isCapturing.value = true
  appendLog('发起截屏请求...', 'info')
  try {
    // 通过 electronAPI 调 main process handle
    // 注意:W5 阶段 stub,真实触发通过全局快捷键;这里按钮直接发 IPC 测试
    appendLog('(W5 阶段)请用快捷键 Cmd/Ctrl+Shift+S 触发', 'info')
  } finally {
    isCapturing.value = false
  }
}

function clearLog() {
  qaLog.value = []
  capturedImage.value = null
  capturedSize.value = ''
  capturedAt.value = ''
}

let cleanup: (() => void) | null = null

onMounted(() => {
  if (!window.electronAPI) return
  // 监听 main 推送的截屏事件
  const handler = (_event: any, payload: any) => {
    capturedAt.value = new Date(payload.ts).toLocaleString('zh-CN')
    capturedSize.value = `${payload.width}x${payload.height} (${payload.sizeBytes} bytes)`
    appendLog(`捕获截图: ${payload.sizeBytes} bytes`, 'info')
    appendLog(`Agent 回复(W5 stub): ${payload.note ?? '...' }`, 'answer')
    // stub: 不真保存图片数据,只显示 placeholder
  }
  // ipcRenderer.on 是 preload 暴露给我们的 API,W5 阶段 stub 通过 window 上手动暴露
  ;(window as any).addEventListener?.('d1-screenshot-captured', (e: any) => handler(null, e.detail))
  cleanup = () => {
    ;(window as any).removeEventListener?.('d1-screenshot-captured')
  }
})

onUnmounted(() => {
  cleanup?.()
})
</script>

<style lang="scss" scoped>
.d1-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d1-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);

  kbd {
    display: inline-block;
    padding: 2px 6px;
    margin: 0 2px;
    font-size: var(--font-size-caption-1, 11px);
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #ddd);
    border-radius: var(--radius-sm, 4px);
    font-family: var(--font-family-mono, monospace);
  }
}

.d1-actions {
  margin-bottom: var(--space-md, 16px);
}

.d1-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-md, 16px);
  margin-bottom: var(--space-lg, 24px);
}

.d1-img {
  max-width: 100%;
  border-radius: var(--radius-sm, 4px);
  margin-top: var(--space-sm, 8px);
}

.d1-meta {
  font-size: var(--font-size-caption-1, 11px);
  color: var(--text-secondary, #666);
  margin-top: var(--space-sm, 8px);
}

.d1-log {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
  background: var(--card-bg, #fafafa);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-sm, 8px);
}

.d1-log-item {
  padding: var(--space-xs, 4px) var(--space-sm, 8px);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--space-xs, 4px);
  font-size: var(--font-size-caption-1, 11px);
  display: flex;
  gap: var(--space-sm, 8px);
}

.d1-info {
  background: rgba(59, 130, 246, 0.08);
}

.d1-answer {
  background: rgba(16, 185, 129, 0.08);
  color: var(--text-primary, #111);
}

.d1-error {
  background: rgba(239, 68, 68, 0.08);
  color: #c92a2a;
}

.d1-log-time {
  font-family: var(--font-family-mono, monospace);
  color: var(--text-secondary, #888);
  font-size: var(--font-size-caption-2, 9px);
  min-width: 60px;
}

.d1-log-content {
  flex: 1;
}
</style>
```

### 6.5 自查清单

- [ ] D1ScreenshotQA.ts: handleD1Shortcut() + d1SkillHandler (export const)
- [ ] GlobalShortcut.ts 末尾追加 registerD1ScreenshotShortcut (export function),既有 export 0 改动
- [ ] D1ScreenshotDemo.vue 用 var(--space-*) / var(--font-size-*) / var(--radius-*) token
- [ ] D1ScreenshotDemo.vue 不引入新依赖(用 Element Plus 现有 el-button)
- [ ] tsc 0 错 + Vue 模板无错

---

## 7. 整体自查清单(W5 都完成后)

1. [ ] 18 个新 agent .ts + 5 个新 insight .ts + 1 个新 skill .ts + 1 个新 view .vue = **25 个新文件**
2. [ ] 1 个修改 (GlobalShortcut.ts 末尾追加 D1 注册)
3. [ ] insight/index.ts 只追加 re-export,既有 W3.1 常量 0 改动
4. [ ] agent/index.ts(如果是新文件,在 W5.2.1 后追加)只追加,既有 W3.1 常量 0 改动
5. [ ] ChatManager.ts / IpcServer.ts / preload.ts / ChatTypes.ts 0 改动
6. [ ] `npx tsc --noEmit` 对本次 W5 改动文件 0 错
7. [ ] `npx vitest run` 71/71 通过
8. [ ] 未跑 git / 未跑 npm install
9. [ ] 未引入新 npm 依赖
10. [ ] 未删除/未重命名任何文件

---

## 8. subagent 工作流

```
1. Read 任务指令文件(本文件,~1700+ 行)
2. Read 1.0.0 真实状态:
   - electron/core/GlobalShortcut.ts 1-100 行(看现有快捷键 0 改动,只末尾追加)
   - electron/chat/ChatTypes.ts (看现有 type,W4.6 已加 StreamChunk)
   - electron/runtime/skill/SkillRuntime.ts (D1 skill handler 注册格式参考)
   - electron/permissions/PermissionManager.ts (ToolRegistry.check 调的方法签名)
   - src/views/Dashboard.vue (Vue view 样式参考)
3. W5.1: Write 5 个 insight 文件 + Edit insight/index.ts 末尾追加 re-export
4. W5.2.1: Write 7 个 agent 基础工具
5. W5.2.2: Write AgentBrain.ts
6. W5.2.3: Write 3 个执行文件
7. W5.2.4: Write 5 个工具链
8. W5.2.5: Write 2 个容错文件
9. W5.3: Write D1ScreenshotQA.ts + Edit GlobalShortcut.ts 末尾追加 + Write D1ScreenshotDemo.vue
10. 自查清单 §7
11. 跑 `npx tsc --noEmit 2>&1 | tail -30`,确认 0 错
12. 跑 `npx vitest run 2>&1`,确认 71/71 通过
13. 报告 7 项(见 §9)
```

---

## 9. 完成报告(返回内容)

1. **3 task + 5 子 task 的 diff 统计**(`git diff --stat`)
2. **新建文件清单**(25 个新文件分类列)
3. **修改文件清单**(GlobalShortcut.ts +N / insight/index.ts +N)
4. **tsc 结果**(`tsc --noEmit` 尾部 30 行,**必须 0 错**)
5. **vitest 结果**(必须 71/71)
6. **遇到难题 + 决策**(W5 是主体工程,会有大量微调)
7. **遗留未改项**

---

## 10. 禁止事项

- **不跑 git**(主会话统一)
- **不跑 npm install**(工具链已就位)
- **不删除**任何文件
- **不重命名**任何文件
- **不修改** 既有 ChatManager / ChatTypes / IpcServer / preload / SkillManager / SkillLoader / contracts(只新增 insight/index.ts re-export 除外)
- **不修改** view / component / store / router(除新建 D1ScreenshotDemo.vue 外)
- **不引入** 任何 npm 依赖
- **不修改** `electron/gateway/`(已删)
- **不修改** GlobalShortcut.ts 既有快捷键函数,只允许在文件末尾追加 registerD1ScreenshotShortcut

---

## 11. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git status --short` 确认改动只在 25 个新文件 + 2 个修改文件(GlobalShortcut.ts + insight/index.ts)
2. `git diff --stat` 看改动规模(预计 ~3500 增)
3. 跑 `npx tsc --noEmit` 确认 0 错
4. 跑 `npx vitest run` 确认 71/71
5. **7 个 commit 落库**(W5.1 / W5.2.1 / W5.2.2 / W5.2.3 / W5.2.4 / W5.2.5 / W5.3)
6. 报告 W5 整体结果