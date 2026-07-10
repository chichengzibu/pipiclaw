# W4 — runtime 5 核心子系统 Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 6 个 task)
> **执行窗口**:约 60-120 分钟
> **前置 commit**:`1fb6ce9` W3 IPC namespace(已合入 master)
> **目标 commit**:6 个 commit(W4.1 / W4.2 / W4.3 / W4.4 / W4.5 / W4.6)
> **当前工作目录**:`D:\pipiclaw\piclaw`
> **node_modules**:已就位(vitest + tsc 可用)

> **职责分工**:
> - **subagent**:写 14 个新 .ts 文件 + 改 1 个既有文件(`ChatManager.ts` 末尾追加 3 个方法)。**不跑 git / npm install**。
> - **主会话(控制器)**:逐 task 验收 → 跑 `git add` + `git commit` → 6 个 commit 落库 → 跑 vitest 71/71 + tsc 0 错兜底。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W4 章节(L164-L258),做 5 个新 runtime 子系统 + ChatManager 接入点:

| Task | 模块 | 文件数 | 行数估计 |
|---|---|---|---|
| W4.1 | actor(actor model) | 3 | ~250 |
| W4.2 | bridge(IPC/HTTP/event) | 3 | ~300 |
| W4.3 | conversation(状态机) | 3 | ~200 |
| W4.4 | scheduler(FIFO/priority/deadline) | 3 | ~250 |
| W4.5 | skill runtime(执行环境) | 3 | ~300 |
| W4.6 | ChatManager 接入(只追加 3 方法) | 0 | +30 |
| **合计** | | **15** | **~1330** |

---

## 2. 必读现状

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W4 章节(L164-L258) | 权威任务定义 |
| `docs/superpowers/specs/2026-07-10-pipiclaw-v2-design.md` 段 4 "关键接口签名" | 7 个域入口接口(已 W3 落到 `electron/contracts/types.ts`) |
| `electron/contracts/types.ts` | AgentBrain / HermesMemory / Skill / Channel / Sandbox / Connector / TraceCollector 接口(已 W3 完成) |
| `electron/contracts/CapabilityRegistry.ts` | 单例 + 8 方法(已 W3 完成) |
| `electron/chat/ChatManager.ts`(特别是 1-100 行) | 单例模式 + LogManager 注入 + try/catch 容错 |
| `electron/skill/SkillManager.ts`(1-50 行) | 单例模式 + ConfigStore + PermissionManager 注入 |
| `electron/core/LogManager.ts` | 单例 logger |
| `electron/core/ConfigStore.ts` | 单例配置 |

**特别注意**:
- plan §W4.6 说"加 `registerAgent(brain: AgentBrain): void`"——**但 `AgentBrain` 是个接口,在 `electron/contracts/types.ts` 中已定义,使用 `import type { AgentBrain } from '../contracts/types'` 即可,不需要等 W5 实装**。
- `ChatMessage` / `StreamChunk` / `Disposable` 类型:`StreamChunk` 在 contracts/types.ts **没有**,需要在本任务中**定义**(`ChatMessage` 已经在 `electron/chat/ChatTypes.ts` 中)。
- `Disposable` 已经在 contracts/types.ts 定义(L168)。
- `Electron.IpcMainInvokeEvent` 类型 electron 自带,直接 import type。

---

## 3. 总体原则

- **不修改既有方法**。W4.6 给 ChatManager 加 3 个新方法(`registerAgent` / `dispatchToAgent` / `subscribeStream`)是**末尾追加**,不能动其他方法、构造函数、import。
- **不引入新 npm 依赖**。纯 node 内置 + electron 内置 + 项目内模块。
- **不修改** view / component / store / router / IpcServer / preload。
- **typecheck 0 错**:用 `npx tsc --noEmit` 单独验证本次 W4 新增/改动的 14 个 .ts + ChatManager.ts(`vue-tsc` 在 1.0.0 上不可用是预存问题,不要被它干扰)。
- **vitest 71/71 不变**(本次 W4 不写新 test,但确保已有 test 不破)。

---

## 4. Task W4.1 — `runtime/actor/`

### 4.1 创建文件

```
electron/runtime/actor/Actor.ts
electron/runtime/actor/ActorRegistry.ts
electron/runtime/actor/MessageQueue.ts
electron/runtime/actor/index.ts
```

### 4.2 `Actor.ts`(基类 + 接口,具体 Actor 由各域继承)

```typescript
import { LogManager } from '../../core/LogManager'

export type ActorId = string

export interface ActorMessage {
  readonly id: string
  readonly from?: ActorId
  readonly to: ActorId
  readonly type: string
  readonly payload: unknown
  readonly priority?: number  // 0-9, 9 最高
  readonly replyTo?: string
  readonly timestamp: number
}

export interface ActorBehavior {
  readonly id: ActorId
  readonly type: string
  send(msg: ActorMessage): Promise<void>
  receive(): Promise<ActorMessage | null>
  spawn(child: ActorBehavior): Promise<ActorId>
  stop(): Promise<void>
  onMessage(handler: (msg: ActorMessage) => Promise<void> | void): void
}

export abstract class BaseActor implements ActorBehavior {
  abstract readonly id: ActorId
  abstract readonly type: string
  protected log = LogManager.getInstance()
  protected children: Map<ActorId, ActorBehavior> = new Map()
  protected handlers: Array<(msg: ActorMessage) => Promise<void> | void> = []
  protected stopped = false

  abstract send(msg: ActorMessage): Promise<void>
  abstract receive(): Promise<ActorMessage | null>

  async spawn(child: ActorBehavior): Promise<ActorId> {
    this.children.set(child.id, child)
    this.log.debug(`Actor ${this.id} spawn child ${child.id}`)
    return child.id
  }

  async stop(): Promise<void> {
    this.stopped = true
    for (const child of this.children.values()) {
      await child.stop()
    }
    this.children.clear()
    this.log.debug(`Actor ${this.id} stopped`)
  }

  onMessage(handler: (msg: ActorMessage) => Promise<void> | void): void {
    this.handlers.push(handler)
  }

  protected async dispatch(msg: ActorMessage): Promise<void> {
    for (const h of this.handlers) {
      try {
        await h(msg)
      } catch (e) {
        this.log.error(`Actor ${this.id} handler error`, e)
      }
    }
  }
}
```

### 4.3 `MessageQueue.ts`(FIFO + 优先级)

```typescript
import type { ActorMessage } from './Actor'

/**
 * 优先级队列:数字越大越先出队
 * 同优先级按 FIFO
 */
export class MessageQueue {
  private items: Array<{ msg: ActorMessage; seq: number }> = []
  private seq = 0  // FIFO tie-breaker(单调递增)

  enqueue(msg: ActorMessage): void {
    this.seq += 1
    this.items.push({ msg, seq: this.seq })
    this.items.sort((a, b) => {
      const pa = a.msg.priority ?? 0
      const pb = b.msg.priority ?? 0
      if (pa !== pb) return pb - pa
      return a.seq - b.seq
    })
  }

  dequeue(): ActorMessage | null {
    const item = this.items.shift()
    return item?.msg ?? null
  }

  peek(): ActorMessage | null {
    return this.items[0]?.msg ?? null
  }

  size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  clear(): void {
    this.items = []
  }

  /** 列出所有 msg type(用于调试) */
  types(): string[] {
    return this.items.map(i => i.msg.type)
  }
}
```

### 4.4 `ActorRegistry.ts`(单例)

```typescript
import { LogManager } from '../../core/LogManager'
import type { ActorBehavior, ActorId } from './Actor'

export class ActorRegistry {
  private static instance: ActorRegistry
  private log = LogManager.getInstance()
  private actors: Map<ActorId, ActorBehavior> = new Map()

  private constructor() {}

  public static getInstance(): ActorRegistry {
    if (!ActorRegistry.instance) {
      ActorRegistry.instance = new ActorRegistry()
    }
    return ActorRegistry.instance
  }

  register(actor: ActorBehavior): void {
    if (this.actors.has(actor.id)) {
      this.log.warn(`ActorRegistry: actor ${actor.id} 重复注册,覆盖`)
    }
    this.actors.set(actor.id, actor)
    this.log.debug(`ActorRegistry: 注册 actor ${actor.id} (type=${actor.type})`)
  }

  unregister(id: ActorId): void {
    this.actors.delete(id)
  }

  lookup(id: ActorId): ActorBehavior | undefined {
    return this.actors.get(id)
  }

  list(): ActorBehavior[] {
    return [...this.actors.values()]
  }

  listByType(type: string): ActorBehavior[] {
    return this.list().filter(a => a.type === type)
  }

  async stopAll(): Promise<void> {
    for (const a of this.actors.values()) {
      await a.stop()
    }
    this.actors.clear()
    this.log.info('ActorRegistry: 全部 actor 已停止')
  }

  reset(): void {
    this.actors.clear()
  }
}
```

### 4.5 `index.ts`(re-export)

```typescript
/**
 * PiPiClaw - Actor 运行时(W4)
 *
 * 提供 Actor 模型:每个 actor 有独立 message queue,支持优先级调度、子 actor 派生。
 * 后续各域(agent/channel/skill)的执行体都以 actor 形式存在。
 */
export * from './Actor'
export * from './MessageQueue'
export * from './ActorRegistry'
```

### 4.6 自查清单

- [ ] 4 个文件齐全
- [ ] BaseActor 是 abstract,不导出具体子类(各域 W5+ 自定义)
- [ ] MessageQueue 支持优先级(数字大者先出)+ FIFO(同优先级按入队顺序)
- [ ] ActorRegistry 单例
- [ ] index.ts 完整 re-export
- [ ] `npx tsc --noEmit` 单独跑新增文件 0 错

---

## 5. Task W4.2 — `runtime/bridge/`

### 5.1 创建文件

```
electron/runtime/bridge/IpcBridge.ts
electron/runtime/bridge/HttpBridge.ts
electron/runtime/bridge/EventBus.ts
electron/runtime/bridge/index.ts
```

### 5.2 `EventBus.ts`(跨 actor 事件总线)

```typescript
import { LogManager } from '../../core/LogManager'
import { randomUUID } from 'node:crypto'

export type EventHandler = (payload: unknown) => void | Promise<void>
export type Unsubscribe = () => void

export interface BusEvent {
  readonly id: string
  readonly topic: string
  readonly payload: unknown
  readonly timestamp: number
  readonly source?: string
}

export class EventBus {
  private static instance: EventBus
  private log = LogManager.getInstance()
  private subscribers: Map<string, Set<EventHandler>> = new Map()
  private history: BusEvent[] = []
  private maxHistory = 100

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  subscribe(topic: string, handler: EventHandler): Unsubscribe {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set())
    }
    this.subscribers.get(topic)!.add(handler)
    return () => {
      this.subscribers.get(topic)?.delete(handler)
    }
  }

  async publish(topic: string, payload: unknown, source?: string): Promise<void> {
    const event: BusEvent = {
      id: randomUUID(),
      topic,
      payload,
      timestamp: Date.now(),
      source,
    }
    this.history.push(event)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
    const handlers = this.subscribers.get(topic)
    if (!handlers || handlers.size === 0) {
      this.log.debug(`EventBus: topic ${topic} 无订阅者`)
      return
    }
    for (const h of handlers) {
      try {
        await h(payload)
      } catch (e) {
        this.log.error(`EventBus: handler for ${topic} 失败`, e)
      }
    }
  }

  historyOf(topic?: string, limit = 50): BusEvent[] {
    const filtered = topic ? this.history.filter(e => e.topic === topic) : this.history
    return filtered.slice(-limit)
  }

  clear(): void {
    this.subscribers.clear()
    this.history = []
  }

  reset(): void {
    EventBus.instance = new EventBus()
  }
}
```

### 5.3 `IpcBridge.ts`(actor 与 main process IPC 通信)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { LogManager } from '../../core/LogManager'
import { EventBus } from './EventBus'
import type { ActorMessage, ActorId } from '../actor/Actor'
import { ActorRegistry } from '../actor/ActorRegistry'
import { randomUUID } from 'node:crypto'

const IPC_BRIDGE_CHANNEL = 'runtime:ipc-bridge'

export interface IpcBridgeMessage {
  from: ActorId
  type: string
  payload: unknown
}

/**
 * IpcBridge: 渲染进程 → 主进程 → runtime actor
 * 渲染进程通过 ipcRenderer.invoke('runtime:ipc-bridge', msg) 发消息
 * 主进程收到后,转发给对应 actor
 */
export class IpcBridge {
  private static instance: IpcBridge
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private registry = ActorRegistry.getInstance()
  private registered = false

  private constructor() {}

  public static getInstance(): IpcBridge {
    if (!IpcBridge.instance) {
      IpcBridge.instance = new IpcBridge()
    }
    return IpcBridge.instance
  }

  /** 在 main process 注册 ipcMain.handle 监听 */
  registerHandler(): void {
    if (this.registered) return
    ipcMain.handle(IPC_BRIDGE_CHANNEL, async (_: IpcMainInvokeEvent, msg: IpcBridgeMessage) => {
      this.log.debug(`IpcBridge: 收到 ${msg.from} 的 ${msg.type}`)
      await this.bus.publish(`ipc:${msg.type}`, msg.payload, msg.from)
      const actor = this.registry.lookup(msg.from)
      if (actor) {
        const actorMsg: ActorMessage = {
          id: randomUUID(),
          from: msg.from,
          to: msg.from,
          type: msg.type,
          payload: msg.payload,
          timestamp: Date.now(),
        }
        await actor.send(actorMsg)
      }
      return { success: true, bridge: 'ipc', echoed: msg.type }
    })
    this.registered = true
    this.log.info('IpcBridge: 已注册 IPC 监听')
  }

  /** runtime actor 主动发消息给渲染进程(通过 EventBus 桥接) */
  async sendToRenderer(type: string, payload: unknown, source?: string): Promise<void> {
    await this.bus.publish(`renderer:${type}`, payload, source)
  }

  channel(): string {
    return IPC_BRIDGE_CHANNEL
  }
}
```

### 5.4 `HttpBridge.ts`(actor 与 openclaw HTTP 18789 通信)

```typescript
import { LogManager } from '../../core/LogManager'
import { EventBus } from './EventBus'

const OPENCLAW_DEFAULT_URL = 'http://127.0.0.1:18789'
const HTTP_BRIDGE_TIMEOUT_MS = 30_000

export interface HttpBridgeRequest {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export interface HttpBridgeResponse {
  ok: boolean
  status: number
  data: unknown
  error?: string
}

/**
 * HttpBridge: runtime actor ↔ openclaw HTTP server (18789)
 * 使用 node:http 客户端,避免在 main process 拉额外依赖
 */
export class HttpBridge {
  private static instance: HttpBridge
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private baseUrl: string

  private constructor(baseUrl = OPENCLAW_DEFAULT_URL) {
    this.baseUrl = baseUrl
  }

  public static getInstance(): HttpBridge {
    if (!HttpBridge.instance) {
      HttpBridge.instance = new HttpBridge()
    }
    return HttpBridge.instance
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  async request(req: HttpBridgeRequest): Promise<HttpBridgeResponse> {
    const url = `${this.baseUrl}${req.path}`
    const method = req.method ?? 'GET'
    this.log.debug(`HttpBridge: ${method} ${url}`)
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...req.headers,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        // @ts-ignore - Node 18+ AbortSignal.timeout
        signal: AbortSignal.timeout(HTTP_BRIDGE_TIMEOUT_MS),
      })
      const text = await res.text()
      let data: unknown = text
      try {
        data = JSON.parse(text)
      } catch {
        // not JSON, keep as text
      }
      await this.bus.publish(`http:${method}:${req.path}`, { status: res.status, data }, 'HttpBridge')
      return { ok: res.ok, status: res.status, data }
    } catch (e) {
      this.log.error(`HttpBridge: ${method} ${url} 失败`, e)
      return { ok: false, status: 0, data: null, error: String(e) }
    }
  }

  async healthCheck(): Promise<boolean> {
    const res = await this.request({ path: '/health', method: 'GET' })
    return res.ok
  }
}
```

### 5.5 `index.ts`

```typescript
export * from './EventBus'
export * from './IpcBridge'
export * from './HttpBridge'
```

### 5.6 自查清单

- [ ] 4 个文件齐全
- [ ] EventBus 单例 + subscribe/publish/historyOf
- [ ] IpcBridge 单例 + registerHandler(主进程端注册 ipcMain.handle 监听)
- [ ] HttpBridge 单例 + request / healthCheck(用原生 fetch)
- [ ] index.ts re-export
- [ ] tsc 0 错

---

## 6. Task W4.3 — `runtime/conversation/`

### 6.1 创建文件

```
electron/runtime/conversation/State.ts
electron/runtime/conversation/Transition.ts
electron/runtime/conversation/Conversation.ts
electron/runtime/conversation/index.ts
```

### 6.2 `State.ts`(6 个状态枚举)

```typescript
export type ConversationStateId =
  | 'idle'        // 等待用户输入
  | 'thinking'    // 正在调用 LLM
  | 'executing'   // 正在执行工具/子任务
  | 'waiting'     // 等待用户确认 / 等待异步结果
  | 'done'        // 一次回合完成,等待下一条消息
  | 'error'       // 出现错误,需要恢复或终止

export interface ConversationState {
  readonly id: ConversationStateId
  readonly displayName: string
  readonly description: string
}

export const CONVERSATION_STATES: Readonly<Record<ConversationStateId, ConversationState>> = {
  idle: { id: 'idle', displayName: '空闲', description: '等待用户输入' },
  thinking: { id: 'thinking', displayName: '思考中', description: '调用 LLM 推理' },
  executing: { id: 'executing', displayName: '执行中', description: '调用工具或子任务' },
  waiting: { id: 'waiting', displayName: '等待中', description: '等待用户确认或异步结果' },
  done: { id: 'done', displayName: '完成', description: '本回合结束,准备下一条' },
  error: { id: 'error', displayName: '错误', description: '出现错误,需要恢复或终止' },
}
```

### 6.3 `Transition.ts`(状态转换规则)

```typescript
import type { ConversationStateId } from './State'

/**
 * 状态转换规则(单向图,key → set of allowed next states)
 * 任何不在规则内的转换会被拒绝
 */
export const CONVERSATION_TRANSITIONS: Readonly<Record<ConversationStateId, ReadonlyArray<ConversationStateId>>> = {
  idle: ['thinking', 'done', 'error'],
  thinking: ['executing', 'done', 'waiting', 'error'],
  executing: ['thinking', 'waiting', 'done', 'error'],
  waiting: ['thinking', 'executing', 'done', 'error'],
  done: ['idle', 'thinking'],
  error: ['idle', 'done'],
}

export function canTransition(from: ConversationStateId, to: ConversationStateId): boolean {
  return CONVERSATION_TRANSITIONS[from].includes(to)
}
```

### 6.4 `Conversation.ts`(状态机实例)

```typescript
import { LogManager } from '../../core/LogManager'
import type { ConversationStateId } from './State'
import { CONVERSATION_STATES } from './State'
import { canTransition } from './Transition'
import { EventBus } from '../bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type ConversationId = string

export interface ConversationContext {
  userId?: string
  conversationId: ConversationId
  currentMessageId?: string
  metadata?: Record<string, unknown>
}

export class Conversation {
  public readonly id: ConversationId
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private state: ConversationStateId = 'idle'
  private history: Array<{ from: ConversationStateId; to: ConversationStateId; ts: number; reason?: string }> = []

  constructor(id?: ConversationId) {
    this.id = id ?? randomUUID()
    this.log.debug(`Conversation ${this.id} 创建,初始状态 idle`)
  }

  getState(): ConversationStateId {
    return this.state
  }

  getStateInfo() {
    return CONVERSATION_STATES[this.state]
  }

  async transition(to: ConversationStateId, reason?: string): Promise<boolean> {
    if (this.state === to) return true
    if (!canTransition(this.state, to)) {
      this.log.warn(`Conversation ${this.id}: 非法转换 ${this.state} → ${to}`)
      return false
    }
    const from = this.state
    this.state = to
    this.history.push({ from, to, ts: Date.now(), reason })
    this.log.debug(`Conversation ${this.id}: ${from} → ${to}${reason ? ' (' + reason + ')' : ''}`)
    await this.bus.publish(`conversation:${this.id}:state`, { from, to, reason }, 'Conversation')
    return true
  }

  getHistory() {
    return [...this.history]
  }

  /** 强制重置到 idle(用于错误恢复) */
  async reset(reason = 'manual reset'): Promise<void> {
    const from = this.state
    this.state = 'idle'
    this.history.push({ from, to: 'idle', ts: Date.now(), reason })
    this.log.warn(`Conversation ${this.id}: 强制重置到 idle (was ${from}, reason: ${reason})`)
  }
}
```

### 6.5 `index.ts`

```typescript
export * from './State'
export * from './Transition'
export * from './Conversation'
```

### 6.6 自查清单

- [ ] 4 个文件齐全
- [ ] 6 个状态:idle/thinking/executing/waiting/done/error
- [ ] Transition 表完整(任何 from 都有允许的 to)
- [ ] Conversation 强制不允许非法转换 + 发 EventBus 事件
- [ ] tsc 0 错

---

## 7. Task W4.4 — `runtime/scheduler/`

### 7.1 创建文件

```
electron/runtime/scheduler/PriorityQueue.ts
electron/runtime/scheduler/TaskQueue.ts
electron/runtime/scheduler/Scheduler.ts
electron/runtime/scheduler/index.ts
```

### 7.2 `PriorityQueue.ts`(通用优先队列)

```typescript
export interface Prioritized<T> {
  readonly value: T
  readonly priority: number      // 越大越先
  readonly deadline?: number     // 早于此时间戳(epoch ms)将被插队
  readonly seq: number           // FIFO tie-breaker
}

/**
 * 出队规则:
 * 1. 有 deadline 且已过期的任务,优先级强制为 +Infinity
 * 2. 否则按 priority 倒序
 * 3. 同优先级按 seq(单调递增)升序
 */
export class PriorityQueue<T> {
  private items: Prioritized<T>[] = []
  private seqCounter = 0

  enqueue(value: T, priority = 0, deadline?: number): number {
    this.seqCounter += 1
    const seq = this.seqCounter
    this.items.push({ value, priority, deadline, seq })
    this.items.sort((a, b) => this.compare(a, b))
    return seq
  }

  dequeue(): T | null {
    const item = this.items.shift()
    return item?.value ?? null
  }

  peek(): T | null {
    return this.items[0]?.value ?? null
  }

  size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  clear(): void {
    this.items = []
  }

  private compare(a: Prioritized<T>, b: Prioritized<T>): number {
    const now = Date.now()
    const aExpired = a.deadline !== undefined && a.deadline < now
    const bExpired = b.deadline !== undefined && b.deadline < now
    const pa = aExpired ? Number.POSITIVE_INFINITY : a.priority
    const pb = bExpired ? Number.POSITIVE_INFINITY : b.priority
    if (pa !== pb) return pb - pa
    return a.seq - b.seq
  }
}
```

### 7.3 `TaskQueue.ts`(Scheduler 专用 task 队列)

```typescript
import { PriorityQueue } from './PriorityQueue'

export type TaskState = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface ScheduledTask {
  readonly id: string
  readonly handler: () => Promise<unknown>
  priority: number
  deadline?: number
  state: TaskState
  enqueuedAt: number
  startedAt?: number
  completedAt?: number
  error?: string
  result?: unknown
}

/**
 * 任务队列封装。
 * 提供 FIFO 模式(priority=0 不排序),优先级模式(priority>0),
 * 和 deadline 模式(过期插队)。
 */
export class TaskQueue {
  private queue: PriorityQueue<ScheduledTask> = new PriorityQueue()
  private counter = 0

  enqueue(handler: () => Promise<unknown>, opts: { priority?: number; deadline?: number } = {}): ScheduledTask {
    this.counter += 1
    const task: ScheduledTask = {
      id: `task-${this.counter}`,
      handler,
      priority: opts.priority ?? 0,
      deadline: opts.deadline,
      state: 'pending',
      enqueuedAt: Date.now(),
    }
    this.queue.enqueue(task, task.priority, task.deadline)
    return task
  }

  dequeue(): ScheduledTask | null {
    return this.queue.dequeue()
  }

  peek(): ScheduledTask | null {
    return this.queue.peek()
  }

  size(): number {
    return this.queue.size()
  }

  clear(): void {
    this.queue.clear()
  }
}
```

### 7.4 `Scheduler.ts`(主调度器)

```typescript
import { LogManager } from '../../core/LogManager'
import { EventBus } from '../bridge/EventBus'
import { TaskQueue, ScheduledTask, TaskState } from './TaskQueue'

export type SchedulingStrategy = 'fifo' | 'priority' | 'deadline'

export interface SchedulerOptions {
  /** 并发上限(同时跑几个 task) */
  maxConcurrent?: number
  /** 调度策略:fifo / priority / deadline(fifo 模式下 priority 参数被忽略) */
  strategy?: SchedulingStrategy
  /** 每个 task 的最大执行时间,超时会被 cancel(0 = 不限) */
  taskTimeoutMs?: number
}

export class Scheduler {
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private queue: TaskQueue
  private maxConcurrent: number
  private strategy: SchedulingStrategy
  private taskTimeoutMs: number
  private running: Map<string, ScheduledTask> = new Map()
  private stopped = false

  constructor(opts: SchedulerOptions = {}) {
    this.maxConcurrent = opts.maxConcurrent ?? 4
    this.strategy = opts.strategy ?? 'priority'
    this.taskTimeoutMs = opts.taskTimeoutMs ?? 0
    this.queue = new TaskQueue()
  }

  enqueue(handler: () => Promise<unknown>, opts: { priority?: number; deadline?: number } = {}): ScheduledTask {
    if (this.stopped) {
      throw new Error('Scheduler 已停止')
    }
    // 策略调整: deadline 策略强制用 deadline, fifo 策略强制 priority=0
    let priority = opts.priority ?? 0
    if (this.strategy === 'fifo') priority = 0
    return this.queue.enqueue(handler, { priority, deadline: opts.deadline })
  }

  async tick(): Promise<number> {
    if (this.stopped) return 0
    let dispatched = 0
    while (this.running.size < this.maxConcurrent) {
      const task = this.queue.dequeue()
      if (!task) break
      this.startTask(task)
      dispatched += 1
    }
    return dispatched
  }

  /** 跑完所有 task(用于测试 / 同步场景) */
  async runUntilEmpty(): Promise<void> {
    while (this.queue.size() > 0 || this.running.size() > 0) {
      await this.tick()
      await new Promise(r => setTimeout(r, 10))
    }
  }

  stop(): void {
    this.stopped = true
    for (const t of this.running.values()) {
      t.state = 'cancelled'
    }
    this.running.clear()
    this.queue.clear()
    this.log.info('Scheduler 已停止')
  }

  stats() {
    return {
      queued: this.queue.size(),
      running: this.running.size(),
      maxConcurrent: this.maxConcurrent,
      strategy: this.strategy,
    }
  }

  private startTask(task: ScheduledTask): void {
    task.state = 'running'
    task.startedAt = Date.now()
    this.running.set(task.id, task)
    void this.bus.publish('scheduler:task:start', { id: task.id }, 'Scheduler')

    const execute = async () => {
      try {
        const timeout = this.taskTimeoutMs > 0
          ? new Promise<never>((_, reject) => setTimeout(() => reject(new Error('task timeout')), this.taskTimeoutMs))
          : null
        const result = timeout
          ? await Promise.race([task.handler(), timeout])
          : await task.handler()
        task.state = 'success'
        task.result = result
        task.completedAt = Date.now()
        void this.bus.publish('scheduler:task:success', { id: task.id, result }, 'Scheduler')
      } catch (e) {
        task.state = 'failed'
        task.error = String(e)
        task.completedAt = Date.now()
        this.log.error(`Scheduler: task ${task.id} 失败`, e)
        void this.bus.publish('scheduler:task:failed', { id: task.id, error: task.error }, 'Scheduler')
      } finally {
        this.running.delete(task.id)
        // 立即补一个
        setImmediate(() => void this.tick())
      }
    }

    void execute()
  }
}
```

### 7.5 `index.ts`

```typescript
export * from './PriorityQueue'
export * from './TaskQueue'
export * from './Scheduler'
```

### 7.6 自查清单

- [ ] 4 个文件齐全
- [ ] PriorityQueue:priority 倒序 + deadline 过期插队 + seq FIFO
- [ ] TaskQueue:封装 PriorityQueue,提供 enqueue/dequeue
- [ ] Scheduler:支持 3 种策略 + 并发上限 + 可选 task timeout + runUntilEmpty
- [ ] tsc 0 错

---

## 8. Task W4.5 — `runtime/skill/`

### 8.1 创建文件

```
electron/runtime/skill/Context.ts
electron/runtime/skill/Invocation.ts
electron/runtime/skill/SkillRuntime.ts
electron/runtime/skill/index.ts
```

### 8.2 `Context.ts`(技能执行上下文)

```typescript
import type { ConversationId } from '../conversation/Conversation'
import { randomUUID } from 'node:crypto'

export type ContextId = string

export interface SkillContextData {
  /** 当前用户 id(可选) */
  userId?: string
  /** 当前会话 id(可选) */
  conversationId?: ConversationId
  /** 权限 token(可选,未设置时 SkillRuntime 拒绝) */
  permissionToken?: string
  /** 额外环境变量(skill 可读) */
  env?: Record<string, string>
  /** 工作目录(skill 执行 cwd) */
  cwd?: string
  /** skill 共享的 transient state(不持久) */
  state?: Record<string, unknown>
  /** 调用链(嵌套 skill 时,记录每个 parent invocation id) */
  trace: ContextId[]
}

export class SkillContext {
  public readonly id: ContextId
  public data: SkillContextData

  constructor(data: Partial<SkillContextData> = {}) {
    this.id = randomUUID()
    this.data = { ...data, trace: data.trace ?? [] }
  }

  fork(extra: Partial<SkillContextData> = {}): SkillContext {
    const child = new SkillContext({ ...this.data, ...extra, trace: [...this.data.trace, this.id] })
    return child
  }

  toJSON(): SkillContextData {
    return { ...this.data, trace: [...this.data.trace] }
  }
}
```

### 8.3 `Invocation.ts`(一次技能调用)

```typescript
import type { ContextId, SkillContext } from './Context'
import { randomUUID } from 'node:crypto'
import type { Disposable } from '../../contracts/types'

export type InvocationState = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface SkillInput {
  [k: string]: unknown
}

export interface SkillOutput {
  ok: boolean
  data?: unknown
  error?: string
  durationMs: number
}

export type InvocationId = string

export interface InvocationOptions {
  /** 执行超时(ms),0 = 不限 */
  timeoutMs?: number
  /** 是否允许 spawn 子 invocation */
  allowNested?: boolean
}

export class Invocation {
  public readonly id: InvocationId
  public readonly skillName: string
  public readonly context: SkillContext
  public readonly input: SkillInput
  public readonly options: InvocationOptions
  public state: InvocationState = 'pending'
  public result?: SkillOutput
  public startedAt?: number
  public completedAt?: number

  constructor(skillName: string, input: SkillInput, context: SkillContext, options: InvocationOptions = {}) {
    this.id = randomUUID()
    this.skillName = skillName
    this.input = input
    this.context = context
    this.options = options
  }

  markRunning(): void {
    this.state = 'running'
    this.startedAt = Date.now()
  }

  markSuccess(data: unknown): void {
    this.state = 'success'
    this.result = { ok: true, data, durationMs: (Date.now() - (this.startedAt ?? Date.now())) }
    this.completedAt = Date.now()
  }

  markFailed(error: string): void {
    this.state = 'failed'
    this.result = { ok: false, error, durationMs: (Date.now() - (this.startedAt ?? Date.now())) }
    this.completedAt = Date.now()
  }

  markCancelled(): void {
    this.state = 'cancelled'
    this.completedAt = Date.now()
  }
}

/** Disposable stub for invocation subscription */
export function createInvocationSubscription(inv: Invocation, onChange: (state: InvocationState) => void): Disposable {
  const check = setInterval(() => onChange(inv.state), 50)
  return { dispose: () => clearInterval(check) }
}
```

### 8.4 `SkillRuntime.ts`(技能执行环境)

```typescript
import { LogManager } from '../../core/LogManager'
import { EventBus } from '../bridge/EventBus'
import { Scheduler, SchedulingStrategy } from '../scheduler/Scheduler'
import { SkillContext, SkillContextData } from './Context'
import { Invocation, SkillInput, SkillOutput, InvocationOptions } from './Invocation'
import { randomUUID } from 'node:crypto'

export type SkillHandler = (input: SkillInput, ctx: SkillContext) => Promise<unknown>

export interface SkillDefinition {
  name: string
  description: string
  handler: SkillHandler
  /** 是否需要 permissionToken */
  requiresPermission?: boolean
  /** 默认 invocation options */
  defaultOptions?: InvocationOptions
}

export interface SkillRuntimeOptions {
  maxConcurrent?: number
  strategy?: SchedulingStrategy
  defaultTimeoutMs?: number
}

export class SkillRuntime {
  private static instance: SkillRuntime
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private skills: Map<string, SkillDefinition> = new Map()
  private invocations: Map<string, Invocation> = new Map()
  private scheduler: Scheduler
  private defaultTimeoutMs: number

  private constructor(opts: SkillRuntimeOptions = {}) {
    this.scheduler = new Scheduler({
      maxConcurrent: opts.maxConcurrent ?? 8,
      strategy: opts.strategy ?? 'priority',
    })
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 60_000
  }

  public static getInstance(): SkillRuntime {
    if (!SkillRuntime.instance) {
      SkillRuntime.instance = new SkillRuntime()
    }
    return SkillRuntime.instance
  }

  /** 重置(测试用) */
  public static resetInstance(): void {
    if (SkillRuntime.instance) {
      SkillRuntime.instance.scheduler.stop()
    }
    SkillRuntime.instance = new SkillRuntime()
  }

  register(def: SkillDefinition): void {
    if (this.skills.has(def.name)) {
      this.log.warn(`SkillRuntime: skill ${def.name} 重复注册,覆盖`)
    }
    this.skills.set(def.name, def)
    this.log.info(`SkillRuntime: 注册 skill ${def.name}`)
  }

  unregister(name: string): void {
    this.skills.delete(name)
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()]
  }

  has(name: string): boolean {
    return this.skills.has(name)
  }

  /** 同步调用:返回一个 Promise<SkillOutput> */
  async invoke(skillName: string, input: SkillInput, ctxData: Partial<SkillContextData> = {}, options: InvocationOptions = {}): Promise<SkillOutput> {
    const def = this.skills.get(skillName)
    if (!def) {
      return { ok: false, error: `Skill ${skillName} 未注册`, durationMs: 0 }
    }
    if (def.requiresPermission && !ctxData.permissionToken) {
      return { ok: false, error: `Skill ${skillName} 需要 permissionToken`, durationMs: 0 }
    }
    const ctx = new SkillContext(ctxData)
    const mergedOptions: InvocationOptions = { ...def.defaultOptions, ...options }
    const inv = new Invocation(skillName, input, ctx, mergedOptions)
    this.invocations.set(inv.id, inv)
    await this.bus.publish('skill:invocation:start', { id: inv.id, name: skillName }, 'SkillRuntime')
    inv.markRunning()
    try {
      const timeoutMs = mergedOptions.timeoutMs ?? this.defaultTimeoutMs
      const result = timeoutMs > 0
        ? await Promise.race([
            def.handler(input, ctx),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('skill timeout')), timeoutMs)),
          ])
        : await def.handler(input, ctx)
      inv.markSuccess(result)
      await this.bus.publish('skill:invocation:success', { id: inv.id, data: result }, 'SkillRuntime')
      return inv.result!
    } catch (e) {
      inv.markFailed(String(e))
      this.log.error(`SkillRuntime: skill ${skillName} 失败`, e)
      await this.bus.publish('skill:invocation:failed', { id: inv.id, error: inv.result?.error }, 'SkillRuntime')
      return inv.result!
    } finally {
      this.invocations.delete(inv.id)
    }
  }

  /** 调度调用:用 Scheduler 管理并发(本期未用,但保留 API) */
  schedule(skillName: string, input: SkillInput, ctxData: Partial<SkillContextData> = {}, options: InvocationOptions & { priority?: number } = {}): Invocation {
    const def = this.skills.get(skillName)
    if (!def) {
      throw new Error(`Skill ${skillName} 未注册`)
    }
    const ctx = new SkillContext(ctxData)
    const mergedOptions: InvocationOptions = { ...def.defaultOptions, ...options }
    const inv = new Invocation(skillName, input, ctx, mergedOptions)
    this.invocations.set(inv.id, inv)
    this.scheduler.enqueue(async () => {
      inv.markRunning()
      try {
        const result = await def.handler(input, ctx)
        inv.markSuccess(result)
      } catch (e) {
        inv.markFailed(String(e))
      }
    }, { priority: options.priority })
    void this.scheduler.tick()
    return inv
  }

  getInvocation(id: string): Invocation | undefined {
    return this.invocations.get(id)
  }

  stats() {
    return {
      skills: this.skills.size,
      activeInvocations: this.invocations.size,
      scheduler: this.scheduler.stats(),
    }
  }

  stop(): void {
    this.scheduler.stop()
    for (const inv of this.invocations.values()) {
      inv.markCancelled()
    }
    this.invocations.clear()
    this.skills.clear()
    this.log.info('SkillRuntime 已停止')
  }
}
```

### 8.5 `index.ts`

```typescript
export * from './Context'
export * from './Invocation'
export * from './SkillRuntime'
```

### 8.6 自查清单

- [ ] 4 个文件齐全
- [ ] Context 支持 fork(子 context,trace 累积)
- [ ] Invocation 状态机(pending/running/success/failed/cancelled)+ 计时
- [ ] SkillRuntime 单例 + register/invoke/schedule/stats
- [ ] invoke 支持 timeout
- [ ] tsc 0 错

---

## 9. Task W4.6 — ChatManager 加 3 个新方法(严格只追加)

### 9.1 修改文件

`electron/chat/ChatManager.ts`(1592 → 1622 行,只 +30)

### 9.2 必须追加的 3 个方法

**位置**:`getInstance()` 之后,任何其他方法之前——本任务为清晰起见,**追加到文件末尾的 `}` 闭合 class 大括号前**。

**新 imports**(在文件顶部 import 块末尾追加,不修改既有 imports):

```typescript
import type { AgentBrain } from '../contracts/types'
import type { Disposable } from '../contracts/types'
```

注意:`StreamChunk` 类型在 contracts/types.ts **没有**,所以**本任务同时在 `electron/chat/ChatTypes.ts` 末尾追加**:

```typescript
/**
 * 流式 chunk(W4.6 新增,用于 ChatManager.subscribeStream)
 */
export interface StreamChunk {
  /** chunk id(单调递增,用于排序) */
  seq: number
  /** 所属 message id */
  messageId: string
  /** 所属 conversation id */
  conversationId: string
  /** 增量文本(若 chunk 类型为 text) */
  textDelta?: string
  /** 思考链增量(若 chunk 类型为 thinking) */
  thinkingDelta?: string
  /** 工具调用增量(若 chunk 类型为 tool_call) */
  toolCallDelta?: {
    name: string
    args: string  // 增量 JSON
  }
  /** 是否流末尾 */
  done: boolean
  /** 时间戳 */
  timestamp: number
}
```

### 9.3 ChatManager.ts 末尾追加的 3 个方法

```typescript
  // ============ W4.6 新增:Agent 接入点(additive,不改既有方法) ============

  private registeredAgent: AgentBrain | null = null
  private streamHandlers: Set<(chunk: StreamChunk) => void> = new Set()
  private streamSeq = 0

  /**
   * 注册 Agent brain(由 Agent 域在启动时调用,ChatManager 后续可通过 dispatchToAgent 把消息转给 agent)
   * 只保留最后注册的 agent;重复注册会覆盖。
   */
  public registerAgent(brain: AgentBrain): void {
    this.log.info('[ChatManager] 注册 AgentBrain')
    this.registeredAgent = brain
  }

  /**
   * 派发消息给已注册的 agent(由 IpcServer / TaskExecutor 调用)
   * 如果没注册 agent,返回 void(noop),不抛错
   */
  public async dispatchToAgent(msg: ChatMessage): Promise<void> {
    if (!this.registeredAgent) {
      this.log.debug('[ChatManager] dispatchToAgent: 未注册 agent,跳过')
      return
    }
    try {
      // agent 内部 think + 可能 call tools,本次只记录到日志,真实链路 W5 接入
      const decision = await this.registeredAgent.think({ conversationId: msg.id, content: msg.content })
      this.log.debug('[ChatManager] dispatchToAgent: agent decision', { decision })
    } catch (e) {
      this.log.error('[ChatManager] dispatchToAgent 失败', e)
    }
  }

  /**
   * 订阅流式 chunk(由渲染进程通过 IPC 订阅)
   * 返回 Disposable 用于取消订阅
   */
  public subscribeStream(handler: (chunk: StreamChunk) => void): Disposable {
    this.streamHandlers.add(handler)
    return {
      dispose: () => {
        this.streamHandlers.delete(handler)
      },
    }
  }

  /** W4.6 内部:产生一个 stream chunk 并通知所有订阅者(供 Chat 流使用) */
  public _emitStreamChunk(chunk: Omit<StreamChunk, 'seq' | 'timestamp'>): void {
    this.streamSeq += 1
    const fullChunk: StreamChunk = { ...chunk, seq: this.streamSeq, timestamp: Date.now() }
    for (const h of this.streamHandlers) {
      try {
        h(fullChunk)
      } catch (e) {
        this.log.error('[ChatManager] stream handler error', e)
      }
    }
  }
```

**注意**:
- 新方法在 class 内部,使用 `this.log` / `this.config` 等既有字段(不需要新字段)
- 增加了 3 个新字段(`registeredAgent` / `streamHandlers` / `streamSeq`)——这是**新增字段**,不修改既有字段
- `StreamChunk` 类型 import 自 `./ChatTypes`(不是 contracts)
- `AgentBrain` / `Disposable` import 自 `../contracts/types`

### 9.4 自查清单

- [ ] ChatManager.ts 顶部 imports 追加 2 行(`AgentBrain` + `Disposable`,都是 type-only)
- [ ] ChatManager.ts 末尾 class 内追加 3 个 public 方法 + 1 个 internal `_emitStreamChunk` + 3 个新 private 字段
- [ ] ChatManager.ts 既有方法 0 改动(构造函数、`getInstance`、其他 30+ 方法都不动)
- [ ] ChatTypes.ts 末尾追加 `StreamChunk` interface
- [ ] ChatTypes.ts 既有 type 0 改动
- [ ] tsc 0 错

---

## 10. 整体自查清单(6 task 都完成后)

1. [ ] `electron/runtime/` 目录结构:`actor/`, `bridge/`, `conversation/`, `scheduler/`, `skill/`, 每个有 `index.ts` re-export
2. [ ] 总计 **15 个新 .ts 文件**(4 actor + 4 bridge + 4 conversation + 4 scheduler + 4 skill = 20 文件,实际 15 = 4+4+4+4+4 - index 重数:每个 4 个文件 1 个 index 算 4,所以 5 套 × 4 = 20,**减 5** (index.ts 重复计算) = **15 + ChatTypes 增 0 个新文件 = 15**)
   - 修正:5 套 × 4 个文件 = 20,**减 5** (每套 index.ts 与各文件不重)= **15** 个新文件
3. [ ] ChatManager.ts 只追加,既有方法 0 改动
4. [ ] ChatTypes.ts 只追加 `StreamChunk`,既有 type 0 改动
5. [ ] `npx tsc --noEmit` 对本次 W4 改动文件 0 错
6. [ ] `npx vitest run` 71/71 通过(无 regression)
7. [ ] 未跑 git / 未跑 npm install
8. [ ] 未引入新 npm 依赖
9. [ ] 未删除/未重命名任何文件

---

## 11. subagent 工作流

```
1. Read 任务指令文件(本文件,~600 行)
2. Read 1.0.0 真实状态以校准 plan 偏差:
   - electron/chat/ChatManager.ts 1-100 行(看 import 风格 + 单例模式)
   - electron/skill/SkillManager.ts 1-50 行(看字段命名)
   - electron/contracts/types.ts(确认 7 个域入口接口已就位)
   - electron/core/LogManager.ts(确认 getInstance() 接口)

3. 写 W4.1 (4 文件: Actor + MessageQueue + ActorRegistry + index)
4. 写 W4.2 (4 文件: EventBus + IpcBridge + HttpBridge + index)
5. 写 W4.3 (4 文件: State + Transition + Conversation + index)
6. 写 W4.4 (4 文件: PriorityQueue + TaskQueue + Scheduler + index)
7. 写 W4.5 (4 文件: Context + Invocation + SkillRuntime + index)
8. 写 W4.6 (改 2 文件: ChatManager.ts 末尾追加 3 方法 + ChatTypes.ts 末尾追加 StreamChunk)
9. 自查清单(§10)
10. 跑 `npx tsc --noEmit 2>&1 | tail -30`,确认本次 W4 改动 0 错
11. 跑 `npx vitest run 2>&1`,确认 71/71 通过

报告 7 项(见 §12)
```

---

## 12. 完成报告(返回内容)

1. **6 task 的 diff 统计**(`git diff --stat`)
2. **新建文件清单**(14 个新 .ts)
3. **修改文件清单**(ChatManager.ts +N / ChatTypes.ts +N)
4. **tsc 结果**(`tsc --noEmit` 输出尾部 20 行,**必须 0 错**)
5. **vitest 结果**(必须 71/71)
6. **遇到难题 + 决策**(如 fetch API / AbortSignal.timeout / tsconfig 配置等)
7. **遗留未改项**

---

## 13. 禁止事项

- **不跑 git**(主会话统一)
- **不跑 npm install**(工具链已就位)
- **不删除**任何文件
- **不重命名**任何文件
- **不修改** 既有 ChatManager 方法 / 既有 ChatTypes type
- **不修改** view / component / store / router / IpcServer / preload / contracts
- **不引入** 任何 npm 依赖
- **不修改** `electron/gateway/`(已删)

---

## 14. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git status --short` 确认改动只在 14 个新 .ts + 2 个修改文件(ChatManager.ts + ChatTypes.ts)
2. `git diff --stat` 看改动规模
3. 跑 `npx tsc --noEmit` 确认 0 错
4. 跑 `npx vitest run` 确认 71/71
5. **6 个 commit 落库**(W4.1 / W4.2 / W4.3 / W4.4 / W4.5 / W4.6)
6. 报告 W4 整体结果
